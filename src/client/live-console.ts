import type { FunctionCall, LiveConnectConfig, LiveSendRealtimeInputParameters, LiveServerMessage, Session } from '@google/genai';
import type { BugBrief, FixJob } from '../shared/types.js';
import { MicrophoneCapture, SpeakerQueue } from './audio.js';
import { bytesToBase64 } from './audio-utils.js';
import { extractLiveEvent, ModelTurnGate, ToolCallLedger, TurnAccumulator, type ClientTurn } from './event-utils.js';
import { readLanguage, saveLanguage, updateLanguageQuery, isLanguage, localizeError, type Language } from './language.js';

export type ConsoleConfig = { repository:string;baseBranch:string;demoUrl:string;configured:{gemini:boolean;github:boolean};models:{live:string;structured:string;agent:string} };
export type ConsoleSnapshot = {
  language:Language;languageRestartNeeded?:boolean;
  config?:ConsoleConfig;connection:'idle'|'connecting'|'connected'|'reconnecting'|'error';
  microphone:'off'|'listening'|'paused';speaking:boolean;visualSource:'none'|'camera'|'screen';
  frame?:string;attachingFrame:boolean;evidenceCount:number;evidenceIds:string[];turns:ClientTurn[];
  report?:BugBrief;readbackComplete:boolean;job?:FixJob;error?:string;
};
export const initialSnapshot:ConsoleSnapshot = {language:'hi',connection:'idle',microphone:'off',speaking:false,visualSource:'none',attachingFrame:false,evidenceCount:0,evidenceIds:[],turns:[],readbackComplete:false};
type BrowserSession = {sessionId:string;csrfToken:string;report?:BugBrief;job?:FixJob;turns?:ClientTurn[];evidence_ids?:string[]};
const TOOL_NAMES = new Set(['prepare_bug_fix','dispatch_bug_fix','get_fix_status','cancel_bug_fix']);
const TERMINAL = new Set(['completed','failed','cancelled','needs_attention']);

function errorMessage(cause:unknown):string {
  if(cause instanceof TypeError && /fetch|network/i.test(cause.message))return 'सर्वर से संपर्क नहीं हुआ। स्थानीय सहायता सर्वर चालू है या नहीं, जाँचें और दोबारा कोशिश करें।';
  if(cause instanceof DOMException){
    if(cause.name==='NotAllowedError')return 'अनुमति नहीं मिली। ब्राउज़र की माइक या स्क्रीन की अनुमति जाँचें। आप लिखकर भी बता सकते हैं।';
    if(cause.name==='NotFoundError')return 'माइक या कैमरा नहीं मिला। उसे जोड़ें, या लिखकर अपनी बात बताइए।';
    if(cause.name==='NotReadableError')return 'माइक या कैमरा किसी दूसरे ऐप में चल रहा है। उसे बंद करके दोबारा कोशिश करें।';
  }
  return cause instanceof Error ? cause.message : 'अभी यह काम पूरा नहीं हुआ। दोबारा कोशिश करें।';
}

export class LiveConsole {
  private snapshot:ConsoleSnapshot={...initialSnapshot};
  private browserSession?:BrowserSession;
  private creatingSession?:Promise<BrowserSession>;
  private live?:Session;
  private speaker?:SpeakerQueue;
  private microphone?:MicrophoneCapture;
  private wantMicrophone=false;
  private turns=new TurnAccumulator();
  private gate=new ModelTurnGate();
  private toolLedger=new ToolCallLedger();
  private pendingTools=new Map<string,{abort:AbortController;name:string}>();
  private persistChain:Promise<unknown>=Promise.resolve();
  private wantConnected=false;
  private destroyed=false;
  private epoch=0;
  private retryCount=0;
  private reconnectTimer?:ReturnType<typeof setTimeout>;
  private resumptionHandle?:string;
  private sharingStream?:MediaStream;
  private sharingVideo?:HTMLVideoElement;
  private frameTimer?:ReturnType<typeof setInterval>;
  private visualEpoch=0;
  private jobEvents?:EventSource;
  private activeModelId?:string;
  private readbackEpoch=0;
  private persistenceFailed=false;
  private setupReject?: (cause:Error)=>void;

  constructor(private onUpdate:(snapshot:ConsoleSnapshot)=>void,language:Language=readLanguage()) {this.snapshot={...initialSnapshot,language};saveLanguage(language);}
  setLanguage(language:Language):void {
    if(this.destroyed || !isLanguage(language) || language===this.snapshot.language)return;
    const restart=this.wantConnected;
    for(const role of ['user','model'] as const){const turn=this.turns.finalize(role);if(turn)this.recordTurn(turn);}
    this.wantConnected=false;this.resumptionHandle=undefined;this.cleanupLive();
    saveLanguage(language);updateLanguageQuery(language);
    this.update({language,languageRestartNeeded:restart,connection:'idle',microphone:'off',speaking:false,readbackComplete:false,error:undefined});
    if(this.browserSession || this.creatingSession)void this.persistEvent({type:'interrupted'}).catch(()=>{});
  }
  private update(patch:Partial<ConsoleSnapshot>):void {
    this.snapshot={...this.snapshot,...patch};
    if(!this.destroyed)this.onUpdate(this.snapshot);
  }
  private showError(cause:unknown):void {this.update({error:localizeError(errorMessage(cause),this.snapshot.language)});}
  async initialize():Promise<void>{
    try{this.update({config:await this.request<ConsoleConfig>('/api/config')});await this.ensureSession();}catch(cause){this.showError(cause);}
  }
  private async request<T>(path:string,body?:unknown,signal?:AbortSignal,method?:'GET'|'POST'):Promise<T>{
    const headers:Record<string,string>={};
    if(body!==undefined){headers['Content-Type']='application/json';if(this.browserSession)headers['X-CSRF-Token']=this.browserSession.csrfToken;}
    const response=await fetch(path,{method:method || (body===undefined?'GET':'POST'),headers,credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body),signal});
    let data:unknown;
    try{data=await response.json();}catch{throw new Error(`सर्वर से पूरा उत्तर नहीं मिला (HTTP ${response.status})।`);}
    if(!response.ok){
      const result=data as {error?:string|{message?:string};message?:string};
      const message=typeof result.error==='string'?result.error:result.error?.message || result.message;
      throw new Error(message || `सर्वर का काम पूरा नहीं हुआ (HTTP ${response.status})।`);
    }
    return data as T;
  }
  private ensureSession():Promise<BrowserSession>{
    if(this.browserSession)return Promise.resolve(this.browserSession);
    if(!this.creatingSession)this.creatingSession=this.request<BrowserSession>('/api/sessions',undefined,undefined,'POST').then(session=>{
      this.browserSession=session;
      if(!this.destroyed){
        const turns=(session.turns || []).map(turn=>({...turn}));
        const evidenceIds=[...(session.evidence_ids || [])];
        this.turns.seedSequence(Math.max(0,...turns.map(turn=>turn.sequence)));
        this.update({turns,evidenceIds,evidenceCount:evidenceIds.length,report:session.report,job:session.job,readbackComplete:false});
        if(session.job)this.watchJob(session.job.id);
      }
      return session;
    }).finally(()=>{this.creatingSession=undefined;});
    return this.creatingSession;
  }
  async connect():Promise<void>{
    if(this.wantConnected || this.destroyed)return;
    if(!navigator.mediaDevices || !window.AudioContext){this.showError(new Error('इस ब्राउज़र में आवाज़ की सुविधा उपलब्ध नहीं है। Chrome या Edge में localhost / HTTPS पर खोलें।'));return;}
    this.wantConnected=true;this.retryCount=0;this.resumptionHandle=undefined;
    const epoch=++this.epoch;
    this.update({connection:'connecting',error:undefined,readbackComplete:false,languageRestartNeeded:false});
    try{
      this.speaker=new SpeakerQueue(speaking=>this.update({speaking}),()=>{const id=this.gate.speakerDrained();if(id)void this.completeModelTurn(id);});
      await this.speaker.resume();
      if(!this.wantConnected || epoch!==this.epoch)return;
      await this.openLive(epoch);
    }catch(cause){if(!this.wantConnected || epoch!==this.epoch)return;this.wantConnected=false;this.cleanupLive();this.update({connection:'error',microphone:'off'});this.showError(cause);}
  }
  private async openLive(epoch=++this.epoch):Promise<void>{
    const language=this.snapshot.language;
    const browserSession=await this.ensureSession();
    if(!this.wantConnected || epoch!==this.epoch)return;
    const token=await this.request<{token:string;model:string;config:LiveConnectConfig}>(`/api/sessions/${browserSession.sessionId}/live-token`,{language});
    if(!this.wantConnected || epoch!==this.epoch)return;
    const {GoogleGenAI}=await import('@google/genai');
    if(!this.wantConnected || epoch!==this.epoch)return;
    const ai=new GoogleGenAI({apiKey:token.token,httpOptions:{apiVersion:'v1beta'}});
    const config:LiveConnectConfig=this.resumptionHandle?{...token.config,sessionResumption:{...token.config.sessionResumption,handle:this.resumptionHandle}}:token.config;
    let resolveSetup!:()=>void;
    let rejectSetup!:(cause:Error)=>void;
    const setup=new Promise<void>((resolve,reject)=>{resolveSetup=resolve;rejectSetup=reject;});
    void setup.catch(()=>{});
    this.setupReject=rejectSetup;
    const timeout=setTimeout(()=>rejectSetup(new Error('आवाज़ के सर्वर से समय पर जवाब नहीं मिला। दोबारा कोशिश करें।')),15000);
    let session:Session;
    try{session=await ai.live.connect({model:token.model,config,callbacks:{
      onopen:()=>{},
      onmessage:(message:LiveServerMessage)=>{if(epoch!==this.epoch || !this.wantConnected)return;if(message.setupComplete)resolveSetup();this.handleMessage(message);},
      onerror:event=>{if(epoch===this.epoch){const error=new Error(event.message || 'आवाज़ का कनेक्शन नहीं चल पाया।');rejectSetup(error);this.showError(error);}},
      onclose:event=>{if(epoch!==this.epoch || !this.wantConnected)return;rejectSetup(new Error(event.reason || 'आवाज़ का कनेक्शन बंद हो गया।'));if(this.snapshot.connection==='connected')this.scheduleReconnect();},
    }});}catch(cause){clearTimeout(timeout);if(this.setupReject===rejectSetup)this.setupReject=undefined;throw cause;}
    if(epoch!==this.epoch || !this.wantConnected){session.close();clearTimeout(timeout);return;}
    this.live=session;
    try{await setup;}finally{clearTimeout(timeout);if(this.setupReject===rejectSetup)this.setupReject=undefined;}
    if(epoch!==this.epoch || !this.wantConnected){session.close();return;}
    this.retryCount=0;this.update({connection:'connected',error:undefined});
    if(!this.microphone){
      const microphone=new MicrophoneCapture();this.microphone=microphone;this.wantMicrophone=true;
      try{await microphone.start(bytes=>{if(this.wantConnected && this.microphone===microphone && this.wantMicrophone && this.snapshot.microphone==='listening')this.sendRealtime({audio:{data:bytesToBase64(bytes),mimeType:'audio/pcm;rate=16000'}});});
        if(this.wantConnected && this.microphone===microphone){microphone.setEnabled(this.wantMicrophone);this.update({microphone:this.wantMicrophone?'listening':'paused'});}else microphone.stop();
      }catch(cause){microphone.stop();if(!this.wantConnected || this.microphone!==microphone)return;this.microphone=undefined;this.wantMicrophone=false;this.update({microphone:'paused'});this.showError(cause);}
    }
  }
  private scheduleReconnect():void {
    if(this.reconnectTimer || !this.wantConnected)return;
    this.gate.interrupt();this.activeModelId=undefined;this.readbackEpoch++;this.speaker?.clear();
    for(const [id,pending] of this.pendingTools){if(pending.name!=='dispatch_bug_fix'){this.toolLedger.cancel([id]);pending.abort.abort();}}
    this.update({connection:'reconnecting',readbackComplete:false});
    void this.persistEvent({type:'interrupted'}).catch(()=>{});
    if(++this.retryCount>3){this.wantConnected=false;this.cleanupLive();this.update({connection:'error',microphone:'off'});this.showError(new Error('तीन कोशिशों के बाद भी आवाज़ नहीं जुड़ी। इंटरनेट जाँचें, फिर “बात शुरू करें” दबाएँ।'));return;}
    const old=this.live;this.live=undefined;this.epoch++;old?.close();
    this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=undefined;const epoch=++this.epoch;void this.openLive(epoch).catch(cause=>{if(!this.wantConnected || epoch!==this.epoch)return;this.showError(cause);this.scheduleReconnect();});},500*2**(this.retryCount-1));
  }
  private handleMessage(message:LiveServerMessage):void {
    const event=extractLiveEvent(message);
    if(event.resumption){this.resumptionHandle=event.resumption.resumable?event.resumption.newHandle:undefined;}
    this.toolLedger.cancel(event.cancelledCallIds);
    for(const id of event.cancelledCallIds){const pending=this.pendingTools.get(id);if(pending && pending.name!=='dispatch_bug_fix')pending.abort.abort();}
    if(event.interrupted){
      this.gate.interrupt();this.activeModelId=undefined;this.readbackEpoch++;this.speaker?.clear();
      const interruptedTurn=this.turns.finalize('model');if(interruptedTurn)this.recordTurn(interruptedTurn);
      this.update({readbackComplete:false});void this.persistEvent({type:'interrupted'}).catch(()=>{});
    }
    if(event.input && (event.input.text || event.input.finished)){
      const turn=event.input.text?this.turns.append('user',event.input.text,event.input.finished===true):this.turns.finalize('user');
      if(turn)this.recordTurn(turn);
    }
    const modelActivity=event.audio.length>0 || !!event.output?.text || event.toolCalls.length>0;
    if(modelActivity){const user=this.turns.finalize('user');if(user)this.recordTurn(user);}
    if(event.output?.text){
      const turn=this.turns.append('model',event.output.text,false);this.activeModelId=turn.id;this.gate.begin(turn.id);this.recordTurn(turn);
    }
    if(event.audio.length>0 && !event.interrupted){
      if(!this.activeModelId){const existing=this.turns.current('model');this.activeModelId=existing && !existing.finalized?existing.id:crypto.randomUUID();this.gate.begin(this.activeModelId);}
      for(const audio of event.audio){try{this.speaker?.enqueue(audio);}catch(cause){this.gate.interrupt();this.showError(cause);}}
    }
    for(const call of event.toolCalls)void this.handleTool(call);
    if(event.turnComplete && !event.interrupted){
      const turn=this.turns.finalize('model');if(turn){this.activeModelId=turn.id;this.gate.begin(turn.id);this.recordTurn(turn);}
      const id=this.gate.serverComplete(this.speaker?.drained ?? true);if(id)void this.completeModelTurn(id);
      this.activeModelId=undefined;
    }
    if(event.goAway)this.scheduleReconnect();
  }
  private recordTurn(turn:ClientTurn):void {
    const turns=this.snapshot.turns.slice();const index=turns.findIndex(item=>item.id===turn.id);
    if(index<0)turns.push(turn);else turns[index]=turn;
    this.update({turns});void this.persistEvent({type:'transcript',turn}).catch(()=>{});
  }
  private persistEvent(event:unknown):Promise<unknown>{
    const next=this.persistChain.then(async()=>{const session=await this.ensureSession();return this.request(`/api/sessions/${session.sessionId}/events`,event);});
    this.persistChain=next.catch(cause=>{this.persistenceFailed=true;this.readbackEpoch++;this.update({readbackComplete:false});this.showError(cause);});return next;
  }
  private async completeModelTurn(turnId:string):Promise<void>{
    const reportId=this.snapshot.report?.id;
    const readbackEpoch=this.readbackEpoch;
    try{const result=await this.persistEvent({type:'model_turn_complete',turnId}) as {ready?:boolean;report_id?:string};
      if(readbackEpoch===this.readbackEpoch && reportId && this.snapshot.report?.id===reportId && result.ready===true)this.update({readbackComplete:true});
    }catch(cause){this.showError(cause);}
  }
  private async handleTool(call:FunctionCall):Promise<void>{
    if(!call.id || !call.name || !this.toolLedger.begin(call.id))return;
    const epoch=this.epoch;const live=this.live;const abort=new AbortController();this.pendingTools.set(call.id,{abort,name:call.name});
    try{
      await this.persistChain;
      if(!this.toolLedger.isPending(call.id) || abort.signal.aborted)return;
      if(this.persistenceFailed)throw new Error('बातचीत पूरी तरह सेव नहीं हुई। सहायता पेज दोबारा खोलकर समस्या बताइए। सुधार अभी शुरू नहीं होगा।');
      const session=await this.ensureSession();
      let args={...(call.args || {})};
      if(call.name==='dispatch_bug_fix')args={...args,consent_turn_id:[...this.snapshot.turns].reverse().find(turn=>turn.role==='user' && turn.finalized)?.id};
      if(call.name==='prepare_bug_fix')args={...args,evidence_ids:this.snapshot.evidenceIds};
      const response=TOOL_NAMES.has(call.name)?await this.request<Record<string,unknown>>(`/api/sessions/${session.sessionId}/tools/${call.name}`,{callId:call.id,args},abort.signal):{error:'यह सुविधा उपलब्ध नहीं है।'};
      if(this.toolLedger.isPending(call.id) || call.name==='dispatch_bug_fix')this.applyToolResult(call.name,response);
      if(this.wantConnected && epoch===this.epoch && live && this.toolLedger.claimResponse(call.id))live.sendToolResponse({functionResponses:[{id:call.id,name:call.name,response}]});
    }catch(cause){
      if(!abort.signal.aborted){const error=localizeError(errorMessage(cause),this.snapshot.language);this.showError(cause);if(this.wantConnected && epoch===this.epoch && live && this.toolLedger.claimResponse(call.id))live.sendToolResponse({functionResponses:[{id:call.id,name:call.name,response:{error}}]});}
    }finally{this.pendingTools.delete(call.id);}
  }
  private applyToolResult(name:string,response:Record<string,unknown>):void {
    if(this.destroyed)return;
    const report=(response.report || response.brief || (response.summary_hi?response:undefined)) as BugBrief | undefined;
    if(name==='prepare_bug_fix' && report?.id){this.readbackEpoch++;this.update({report,readbackComplete:false});}
    const job=(response.job || (response.id && response.status?response:undefined)) as FixJob | undefined;
    if(job?.id){this.update({job});this.watchJob(job.id);}
    const jobId=typeof response.job_id==='string'?response.job_id:undefined;
    if(jobId){this.watchJob(jobId);void this.refreshJob(jobId);}
  }
  private watchJob(id:string):void {
    if(this.snapshot.job?.id===id && TERMINAL.has(this.snapshot.job.status)){this.jobEvents?.close();this.jobEvents=undefined;return;}
    if(this.jobEvents?.url.endsWith(`/api/jobs/${encodeURIComponent(id)}/events`))return;
    this.jobEvents?.close();
    const source=new EventSource(`/api/jobs/${encodeURIComponent(id)}/events`);this.jobEvents=source;
    source.onmessage=event=>{try{const job=JSON.parse(event.data) as FixJob;if(job.id!==id)return;this.update({job});if(TERMINAL.has(job.status)){source.close();if(this.jobEvents===source)this.jobEvents=undefined;}}catch(cause){this.showError(cause);}};
    source.onerror=()=>{if(this.snapshot.job && TERMINAL.has(this.snapshot.job.status))source.close();};
  }
  private async refreshJob(id:string):Promise<void>{try{const response=await this.request<FixJob|{job:FixJob}>(`/api/jobs/${encodeURIComponent(id)}`);const job='job' in response?response.job:response;this.update({job});}catch(cause){this.showError(cause);}}
  async sendText(text:string):Promise<void>{
    if(!this.live || this.snapshot.connection!=='connected')return;
    const live=this.live,epoch=this.epoch;
    const pending=this.turns.finalize('user');if(pending)this.recordTurn(pending);
    const turn=this.turns.append('user',text,true);this.recordTurn(turn);
    try{await this.persistChain;if(!this.wantConnected || epoch!==this.epoch)return;if(this.persistenceFailed)throw new Error('संदेश सेव नहीं हुआ। सहायता पेज दोबारा खोलें।');live.sendRealtimeInput({text});}catch(cause){if(epoch===this.epoch)this.showError(cause);}
  }
  async toggleMicrophone():Promise<void>{
    if(!this.live || this.snapshot.connection!=='connected')return;
    if(this.snapshot.microphone==='listening'){this.wantMicrophone=false;this.microphone?.setEnabled(false);this.sendRealtime({audioStreamEnd:true});this.update({microphone:'paused'});return;}
    const microphone=this.microphone || new MicrophoneCapture();this.wantMicrophone=true;
    try{
      if(!this.microphone){this.microphone=microphone;await microphone.start(bytes=>{if(this.wantConnected && this.microphone===microphone && this.wantMicrophone && this.snapshot.microphone==='listening')this.sendRealtime({audio:{data:bytesToBase64(bytes),mimeType:'audio/pcm;rate=16000'}});});}
      if(!this.wantConnected || this.microphone!==microphone){microphone.stop();return;}
      microphone.setEnabled(this.wantMicrophone);this.update({microphone:this.wantMicrophone?'listening':'paused',error:undefined});
    }catch(cause){microphone.stop();if(!this.wantConnected || this.microphone!==microphone)return;this.microphone=undefined;this.wantMicrophone=false;this.update({microphone:'paused'});this.showError(cause);}
  }
  async startVisual(source:'camera'|'screen'):Promise<void>{
    if(this.snapshot.connection!=='connected')return;
    this.stopVisual();const epoch=++this.visualEpoch;
    try{
      const stream=source==='screen'?await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:1,max:1}},audio:false}):await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:1,max:1}},audio:false});
      if(epoch!==this.visualEpoch || !this.wantConnected){stream.getTracks().forEach(track=>track.stop());return;}
      this.sharingStream=stream;const video=document.createElement('video');video.className='hidden-video';video.muted=true;video.playsInline=true;video.srcObject=stream;document.body.appendChild(video);this.sharingVideo=video;await video.play();
      if(epoch!==this.visualEpoch || !this.wantConnected){stream.getTracks().forEach(track=>track.stop());video.pause();video.srcObject=null;video.remove();return;}
      stream.getVideoTracks()[0].addEventListener('ended',()=>{if(this.sharingStream===stream)this.stopVisual();},{once:true});
      this.update({visualSource:source,error:undefined});this.captureFrame();this.frameTimer=setInterval(()=>this.captureFrame(),1000);
    }catch(cause){if(epoch===this.visualEpoch){this.stopVisual();this.showError(cause);}}
  }
  private captureFrame():void {
    const video=this.sharingVideo;if(!video || !video.videoWidth || !this.live || this.snapshot.connection!=='connected')return;
    const canvas=document.createElement('canvas');const scale=Math.min(1,1280/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    const context=canvas.getContext('2d');if(!context)return;context.drawImage(video,0,0,canvas.width,canvas.height);const frame=canvas.toDataURL('image/jpeg',0.72);
    this.update({frame});this.sendRealtime({video:{data:frame.split(',')[1],mimeType:'image/jpeg'}});
  }
  private sendRealtime(input:LiveSendRealtimeInputParameters):void {
    if(!this.live || this.snapshot.connection!=='connected')return;
    try{this.live.sendRealtimeInput(input);}catch(cause){this.showError(cause);this.scheduleReconnect();}
  }
  stopVisual():void {
    this.visualEpoch++;if(this.frameTimer)clearInterval(this.frameTimer);this.frameTimer=undefined;
    this.sharingStream?.getTracks().forEach(track=>track.stop());this.sharingStream=undefined;
    if(this.sharingVideo){this.sharingVideo.pause();this.sharingVideo.srcObject=null;this.sharingVideo.remove();this.sharingVideo=undefined;}
    this.update({visualSource:'none',frame:undefined});
  }
  async attachFrame():Promise<void>{
    if(!this.snapshot.frame || this.snapshot.attachingFrame)return;
    const frame=this.snapshot.frame;this.update({attachingFrame:true});
    try{const session=await this.ensureSession();const result=await this.request<{id:string}>(`/api/sessions/${session.sessionId}/evidence`,{data:frame.split(',')[1],mime_type:'image/jpeg'});const evidenceIds=[...this.snapshot.evidenceIds,result.id];this.update({evidenceIds,evidenceCount:evidenceIds.length});}
    catch(cause){this.showError(cause);}finally{this.update({attachingFrame:false});}
  }
  async cancelJob():Promise<void>{
    if(!this.snapshot.job || TERMINAL.has(this.snapshot.job.status))return;
    try{const session=await this.ensureSession();const response=await this.request<Record<string,unknown>>(`/api/sessions/${session.sessionId}/tools/cancel_bug_fix`,{callId:crypto.randomUUID(),args:{job_id:this.snapshot.job.id}});this.applyToolResult('cancel_bug_fix',response);}catch(cause){this.showError(cause);}
  }
  async prepareFriction():Promise<boolean>{try{await this.ensureSession();return true;}catch(cause){this.showError(cause);return false;}}
  async saveFriction(entry:Record<string,unknown>):Promise<void>{await this.ensureSession();await this.request('/api/friction',entry);}
  private cleanupLive():void {
    this.epoch++;this.setupReject?.(new Error('बात समाप्त हो गई।'));this.setupReject=undefined;
    if(this.reconnectTimer)clearTimeout(this.reconnectTimer);this.reconnectTimer=undefined;
    const live=this.live;this.live=undefined;try{live?.sendRealtimeInput({audioStreamEnd:true});}catch{}live?.close();
    this.toolLedger.cancel([...this.pendingTools.keys()]);for(const request of this.pendingTools.values())if(request.name!=='dispatch_bug_fix')request.abort.abort();
    this.gate.interrupt();this.activeModelId=undefined;this.readbackEpoch++;this.wantMicrophone=false;this.microphone?.stop();this.microphone=undefined;this.speaker?.close();this.speaker=undefined;this.stopVisual();
  }
  disconnect():void {this.wantConnected=false;this.cleanupLive();this.update({connection:'idle',microphone:'off',speaking:false,readbackComplete:false});void this.persistEvent({type:'interrupted'}).catch(()=>{});}
  destroy():void {this.destroyed=true;this.wantConnected=false;this.cleanupLive();this.jobEvents?.close();this.jobEvents=undefined;}
}
