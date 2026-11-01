import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveConnectParameters, Session } from '@google/genai';
import { LiveServerMessage } from '@google/genai';
import { LiveConsole, initialSnapshot, type ConsoleSnapshot } from '../src/client/live-console.js';
import type { BugBrief, FixJob } from '../src/shared/types.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App, {ReportCard, JobCard, FrictionDrawer} from '../src/client/App.js';

const sdk = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock('@google/genai', async importOriginal => ({ ...await importOriginal<typeof import('@google/genai')>(),GoogleGenAI: class { live = { connect: (parameters:LiveConnectParameters)=>sdk.connect(parameters) }; } }));
const config = { repository:'example/kirana',baseBranch:'main',demoUrl:'http://127.0.0.1:4301',configured:{gemini:true,github:true},models:{live:'gemini-live',structured:'gemini-flash',agent:'agent'} };
const report:BugBrief = { id:'report-1',session_id:'session-1',version:1,summary_hi:'स्टॉक बढ़ गया',summary_en:'Stock increased',reproduction_hi:['7 किलो बेचें'],reproduction_en:['Sell 7 kg'],expected_hi:'13 किलो बचें',actual_hi:'27 किलो दिखें',expected_en:'13 kg remains',actual_en:'27 kg shown',quantities:[],evidence_ids:['evidence-1'],repository:'example/kirana',base_sha:'a'.repeat(40),base_branch:'main',created_at:'2026-11-01T10:00:00Z' };
const job:FixJob = { id:'job-1',session_id:'session-1',report_id:report.id,status:'running',stage:'agent_running',message_hi:'एजेंट समस्या को दोहरा कर सुधार खोज रहा है।',attempt:1,created_at:'2026-11-01T10:01:00Z',updated_at:'2026-11-01T10:02:00Z',deadline_at:'2026-11-01T10:16:00Z' };
const resumed = { sessionId:'session-1',csrfToken:'rotated-csrf',report,job,evidence_ids:['evidence-1'],turns:[{id:'turn-1',role:'user',text:'स्टॉक बढ़ गया',sequence:1,finalized:true}] };
const token = { token:'ephemeral-fixture',model:'gemini-live',config:{} };
const controllers:LiveConsole[] = [];

function controller(onUpdate:(snapshot:ConsoleSnapshot)=>void = ()=>{}) { const result=new LiveConsole(onUpdate);controllers.push(result);return result; }
function changeLanguage(console:LiveConsole, language:'hi'|'en') { console.setLanguage(language); }
function fakeSession() { return { close:vi.fn(),sendRealtimeInput:vi.fn(),sendToolResponse:vi.fn() } as unknown as Session; }
function message(value:Partial<LiveServerMessage>):LiveServerMessage { return Object.assign(new LiveServerMessage(),value); }
function browser(search='',stored:string|null=null) {
  const storage = new Map<string,string>(stored ? [['kirana-saathi.language.v1',stored]] : []);
  const store={getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)};
  class AudioContext { state='running';currentTime=0;destination={};audioWorklet={addModule:async()=>{}};resume=async()=>{};close=async()=>{this.state='closed';};createMediaStreamSource=()=>({connect:()=>{},disconnect:()=>{}});createGain=()=>({gain:{value:0},connect:()=>{},disconnect:()=>{}}); }
  const worklets:Array<{port:{onmessage:((event:MessageEvent<ArrayBuffer>)=>void)|null}}> = [];
  class AudioWorkletNode {port:{onmessage:((event:MessageEvent<ArrayBuffer>)=>void)|null;postMessage:()=>void}={onmessage:null,postMessage:()=>{}};connect=()=>{};disconnect=()=>{};constructor(){worklets.push(this);}}
  const track={enabled:true,stop:vi.fn()};
  const location={search,href:`http://127.0.0.1:4300/${search}`};
  vi.stubGlobal('window',{location,AudioContext,localStorage:store,history:{state:null,replaceState:(_state:unknown,_unused:string,value:URL)=>{location.href=value.href;location.search=value.search;}}});
  vi.stubGlobal('localStorage',store);
  vi.stubGlobal('AudioContext',AudioContext);
  vi.stubGlobal('AudioWorkletNode',AudioWorkletNode);
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]})}});
  vi.stubGlobal('document',{documentElement:{lang:''},title:''});
  const streams:Array<{onmessage:((event:MessageEvent<string>)=>void)|null;close:()=>void;url:string}>=[];
  vi.stubGlobal('EventSource',class {onmessage=null;onerror=null;close=vi.fn();constructor(readonly url:string){streams.push(this);}});
  return {storage,track,streams,worklets};
}
function installRequests(overrides?:{liveToken?:()=>Promise<Response>;events?:(body:Record<string,unknown>)=>Promise<Response>}) {
  const requests:Array<{path:string;request:RequestInit}>=[];
  vi.stubGlobal('fetch',async(path:string,request:RequestInit={})=>{
    requests.push({path,request});
    if(path==='/api/config')return Response.json(config);
    if(path==='/api/sessions')return Response.json(resumed);
    if(path.endsWith('/live-token'))return overrides?.liveToken?.()??Response.json(token);
    if(path.endsWith('/events'))return overrides?.events?.(JSON.parse(String(request.body)))??Response.json({ok:true});
    throw new Error(`Unexpected request: ${path}`);
  });
  return requests;
}
beforeEach(()=>{sdk.connect.mockReset();});
afterEach(()=>{controllers.splice(0).forEach(console=>console.destroy());vi.unstubAllGlobals();});

describe('console language lifecycle',()=>{
  it('restores English from storage and preserves restored evidence',async()=>{
    browser('', 'en');installRequests();let snapshot:ConsoleSnapshot=initialSnapshot;
    await controller(value=>snapshot=value).initialize();
    expect(snapshot).toMatchObject({language:'en',turns:resumed.turns,evidenceIds:['evidence-1'],job,report});
    expect(document.documentElement.lang).toBe('en');expect(document.title).toBe('Kirana Saathi · App help');
  });
  it('persists a changed language even when storage is unavailable',async()=>{
    browser();vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('Blocked');},setItem:()=>{throw new Error('Blocked');}});
    installRequests();let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);await console.initialize();
    changeLanguage(console,'en');expect(snapshot.language).toBe('en');expect(document.documentElement.lang).toBe('en');
  });
  it('localizes known server errors after selecting English',async()=>{
    browser('?lang=en');installRequests({liveToken:async()=>Response.json({error:'सत्र की पुष्टि नहीं हुई। सहायता फिर खोलें।'},{status:403})});
    let snapshot:ConsoleSnapshot=initialSnapshot;await controller(value=>snapshot=value).connect();
    expect(snapshot.error).toBe('The session could not be verified. Reopen app help.');
  });
  it('uses a valid query override and sends it with the normal CSRF token',async()=>{
    browser('?lang=en','hi');const requests=installRequests();
    sdk.connect.mockImplementation(async(parameters:LiveConnectParameters)=>{parameters.callbacks?.onmessage?.(message({setupComplete:{}}));return fakeSession();});
    const console=controller();await console.initialize();await console.connect();
    const request=requests.find(entry=>entry.path.endsWith('/live-token'))!.request;
    expect(JSON.parse(String(request.body))).toEqual({language:'en'});
    expect(request.headers).toEqual({'Content-Type':'application/json','X-CSRF-Token':'rotated-csrf'});
  });
  it('ignores invalid query and stored values and requests Hindi by default',async()=>{
    browser('?lang=fr','other');const requests=installRequests();
    sdk.connect.mockImplementation(async(parameters:LiveConnectParameters)=>{parameters.callbacks?.onmessage?.(message({setupComplete:{}}));return fakeSession();});
    await controller().connect();
    expect(JSON.parse(String(requests.find(entry=>entry.path.endsWith('/live-token'))!.request.body))).toEqual({language:'hi'});
  });
  it('invalidates a pending token when language changes and keeps the durable job subscribed',async()=>{
    const hardware=browser();let release!:(response:Response)=>void;
    const pending=new Promise<Response>(resolve=>release=resolve);const requests=installRequests({liveToken:()=>pending});
    let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);await console.initialize();
    const connecting=console.connect();await vi.waitFor(()=>expect(requests.some(entry=>entry.path.endsWith('/live-token'))).toBe(true));
    changeLanguage(console,'en');release(Response.json(token));await connecting;
    expect(snapshot).toMatchObject({language:'en',connection:'idle',readbackComplete:false,job,report,turns:resumed.turns,evidenceIds:['evidence-1']});
    expect(hardware.streams[0].close).not.toHaveBeenCalled();
    expect(sdk.connect).not.toHaveBeenCalled();
    await vi.waitFor(()=>expect(requests.filter(entry=>entry.path.endsWith('/events')).map(entry=>JSON.parse(String(entry.request.body)))).toContainEqual({type:'interrupted'}));
    expect(requests.some(entry=>entry.path.includes('/tools/'))).toBe(false);
  });
  it('closes a connecting old session and rejects its late tool calls before a fresh English connection',async()=>{
    const hardware=browser();const requests=installRequests();const old=fakeSession();let release!:(session:Session)=>void;
    let oldParameters!:LiveConnectParameters;
    sdk.connect.mockImplementationOnce((parameters:LiveConnectParameters)=>{oldParameters=parameters;return new Promise<Session>(resolve=>release=resolve);});
    let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);const connecting=console.connect();
    await vi.waitFor(()=>expect(sdk.connect).toHaveBeenCalledTimes(1));changeLanguage(console,'en');
    oldParameters.callbacks?.onmessage?.(message({toolCall:{functionCalls:[{id:'stale',name:'dispatch_bug_fix',args:{report_id:report.id,version:1}}]}}));
    release(old);await connecting;expect(old.close).toHaveBeenCalledTimes(1);
    sdk.connect.mockImplementationOnce(async(parameters:LiveConnectParameters)=>{parameters.callbacks?.onmessage?.(message({setupComplete:{}}));return fakeSession();});
    await console.connect();expect(snapshot.connection).toBe('connected');expect(snapshot.job?.id).toBe('job-1');
    expect(requests.filter(entry=>entry.path.endsWith('/live-token')).map(entry=>JSON.parse(String(entry.request.body)))).toEqual([{language:'hi'},{language:'en'}]);
    expect(requests.some(entry=>entry.path.includes('/tools/'))).toBe(false);expect(hardware.streams[0].close).not.toHaveBeenCalled();
  });
  it('stops connected media and clears resumption context without cancelling a job or rewriting turns',async()=>{
    const hardware=browser();const requests=installRequests();const sessions=[fakeSession(),fakeSession()];let firstParameters!:LiveConnectParameters;
    sdk.connect.mockImplementation(async(parameters:LiveConnectParameters)=>{firstParameters??=parameters;parameters.callbacks?.onmessage?.(message({setupComplete:{}}));return sessions.shift()!;});
    let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);await console.connect();
    firstParameters.callbacks?.onmessage?.(message({sessionResumptionUpdate:{resumable:true,newHandle:'old-hindi-context'}}));
    changeLanguage(console,'en');expect(hardware.track.stop).toHaveBeenCalled();expect(snapshot.connection).toBe('idle');
    expect(snapshot.turns).toEqual(resumed.turns);expect(snapshot.job).toEqual(job);await console.connect();
    expect(sdk.connect.mock.calls[1][0].config.sessionResumption?.handle).toBeUndefined();
    expect(requests.some(entry=>entry.path.includes('/tools/'))).toBe(false);
  });
  it('does not let an old microphone permission failure stop the new language connection',async()=>{
    const hardware=browser();installRequests();let reject!:(cause:Error)=>void;
    const permission=new Promise<MediaStream>((_,fail)=>reject=fail);
    const stream={getTracks:()=>[hardware.track],getAudioTracks:()=>[hardware.track]} as unknown as MediaStream;
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockReturnValueOnce(permission).mockResolvedValue(stream)}});
    sdk.connect.mockImplementation(async(parameters:LiveConnectParameters)=>{parameters.callbacks?.onmessage?.(message({setupComplete:{}}));return fakeSession();});
    let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);const old=console.connect();
    await vi.waitFor(()=>expect(snapshot.connection).toBe('connected'));changeLanguage(console,'en');await console.connect();
    reject(new DOMException('No permission','NotAllowedError'));await old;
    expect(snapshot).toMatchObject({language:'en',connection:'connected',microphone:'listening',error:undefined});
  });
  it('does not send pending old-language text into a newly connected session',async()=>{
    browser();let release!:(response:Response)=>void;
    const persisted=new Promise<Response>(resolve=>release=resolve);
    installRequests({events:async(body)=>body.type==='transcript'?persisted:Response.json({ok:true})});
    const old=fakeSession(),fresh=fakeSession();const sessions=[old,fresh];
    sdk.connect.mockImplementation(async(parameters:LiveConnectParameters)=>{parameters.callbacks?.onmessage?.(message({setupComplete:{}}));return sessions.shift()!;});
    const console=controller();await console.connect();const sending=console.sendText('एक और समस्या');
    changeLanguage(console,'en');await console.connect();release(Response.json({ok:true}));await sending;
    expect(fresh.sendRealtimeInput).not.toHaveBeenCalled();
  });
  it('invalidates a pending readback completion without altering report data',async()=>{
    browser();let release!:(response:Response)=>void;
    const pending=new Promise<Response>(resolve=>release=resolve);
    installRequests({events:async(body)=>body.type==='model_turn_complete'?pending:Response.json({ok:true})});
    let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);await console.initialize();
    const completion=console['completeModelTurn']('model-readback');changeLanguage(console,'en');
    release(Response.json({ready:true,report_id:report.id}));await completion;
    expect(snapshot.readbackComplete).toBe(false);expect(snapshot.report).toEqual(report);expect(snapshot.job).toEqual(job);
  });
  it('retains an explicit language change when reloading a link with a language query',async()=>{
    const hardware=browser('?lang=en','hi');installRequests();let snapshot:ConsoleSnapshot=initialSnapshot;const first=controller(value=>snapshot=value);
    await first.initialize();changeLanguage(first,'hi');await controller(value=>snapshot=value).initialize();
    expect(snapshot.language).toBe('hi');expect(hardware.storage.get('kirana-saathi.language.v1')).toBe('hi');
    expect(window.location.search).toBe('?lang=hi');
  });
  it('keeps partial Hindi and English transcripts as separate turns across a language change',async()=>{
    browser();installRequests();let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);await console.initialize();
    console['handleMessage'](message({serverContent:{inputTranscription:{text:'एक सवाल',finished:false}}}));
    changeLanguage(console,'en');console['handleMessage'](message({serverContent:{inputTranscription:{text:'Another question',finished:true}}}));
    expect(snapshot.turns.slice(-2).map(turn=>[turn.text,turn.finalized])).toEqual([['एक सवाल',true],['Another question',true]]);
  });
  it('ignores a late microphone retry failure after changing language',async()=>{
    const hardware=browser();installRequests();let reject!:(cause:Error)=>void;
    const permission=new Promise<MediaStream>((_,fail)=>reject=fail);
    const stream={getTracks:()=>[hardware.track],getAudioTracks:()=>[hardware.track]} as unknown as MediaStream;
    const denied=new DOMException('No permission','NotAllowedError');
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockRejectedValueOnce(denied).mockReturnValueOnce(permission).mockResolvedValue(stream)}});
    sdk.connect.mockImplementation(async(parameters:LiveConnectParameters)=>{parameters.callbacks?.onmessage?.(message({setupComplete:{}}));return fakeSession();});
    let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);await console.connect();
    const retry=console.toggleMicrophone();changeLanguage(console,'en');await console.connect();reject(denied);await retry;
    expect(snapshot).toMatchObject({language:'en',connection:'connected',microphone:'listening',error:undefined});
    expect(hardware.track.stop).not.toHaveBeenCalled();
  });
  it('forwards retained microphone retry audio to the new Live session after reconnect',async()=>{
    const hardware=browser();installRequests();
    const stream={getTracks:()=>[hardware.track],getAudioTracks:()=>[hardware.track]} as unknown as MediaStream;
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockRejectedValueOnce(new DOMException('No permission','NotAllowedError')).mockResolvedValue(stream)}});
    const sessions=[fakeSession(),fakeSession()],parameters:LiveConnectParameters[]=[];
    sdk.connect.mockImplementation(async(value:LiveConnectParameters)=>{parameters.push(value);value.callbacks?.onmessage?.(message({setupComplete:{}}));return sessions[parameters.length-1];});
    let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);await console.connect();await console.toggleMicrophone();
    const pcm=new MessageEvent<ArrayBuffer>('message',{data:new Uint8Array([16,0]).buffer});
    hardware.worklets[0].port.onmessage?.(pcm);
    expect(sessions[0].sendRealtimeInput).toHaveBeenCalledWith({audio:{data:'EAA=',mimeType:'audio/pcm;rate=16000'}});
    parameters[0].callbacks?.onmessage?.(message({goAway:{timeLeft:'1s'}}));
    await vi.waitFor(()=>expect(snapshot.connection).toBe('connected'),{timeout:1500});
    expect(parameters).toHaveLength(2);expect(snapshot.microphone).toBe('listening');
    hardware.worklets[0].port.onmessage?.(pcm);
    expect(sessions[1].sendRealtimeInput).toHaveBeenCalledWith({audio:{data:'EAA=',mimeType:'audio/pcm;rate=16000'}});
    expect(hardware.track.stop).not.toHaveBeenCalled();
  });
  it.each(['initial','retry'] as const)('keeps %s microphone permission completion usable when the same capture reconnects',async(kind)=>{
    const hardware=browser();installRequests();let release!:(stream:MediaStream)=>void;
    const permission=new Promise<MediaStream>(resolve=>release=resolve);
    const stream={getTracks:()=>[hardware.track],getAudioTracks:()=>[hardware.track]} as unknown as MediaStream;
    const media=vi.fn();if(kind==='retry')media.mockRejectedValueOnce(new DOMException('No permission','NotAllowedError'));media.mockReturnValueOnce(permission);
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:media}});
    const sessions=[fakeSession(),fakeSession()],parameters:LiveConnectParameters[]=[];
    sdk.connect.mockImplementation(async(value:LiveConnectParameters)=>{parameters.push(value);value.callbacks?.onmessage?.(message({setupComplete:{}}));return sessions[parameters.length-1];});
    let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);
    let starting:Promise<void>;if(kind==='retry'){await console.connect();starting=console.toggleMicrophone();}else starting=console.connect();
    await vi.waitFor(()=>expect(snapshot.connection).toBe('connected'));
    parameters[0].callbacks?.onmessage?.(message({goAway:{timeLeft:'1s'}}));
    await vi.waitFor(()=>expect(parameters).toHaveLength(2),{timeout:1500});
    release(stream);await starting;
    expect(snapshot).toMatchObject({connection:'connected',microphone:'listening',error:undefined});
    expect(hardware.track.stop).not.toHaveBeenCalled();
    hardware.worklets[0].port.onmessage?.(new MessageEvent<ArrayBuffer>('message',{data:new Uint8Array([16,0]).buffer}));
    expect(sessions[1].sendRealtimeInput).toHaveBeenCalledWith({audio:{data:'EAA=',mimeType:'audio/pcm;rate=16000'}});
  });
  it('preserves a user pause when pending microphone permission completes after reconnect',async()=>{
    const hardware=browser();installRequests();let release!:(stream:MediaStream)=>void;
    const permission=new Promise<MediaStream>(resolve=>release=resolve);
    const stream={getTracks:()=>[hardware.track],getAudioTracks:()=>[hardware.track]} as unknown as MediaStream;
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:()=>permission}});
    const sessions=[fakeSession(),fakeSession()],parameters:LiveConnectParameters[]=[];
    sdk.connect.mockImplementation(async(value:LiveConnectParameters)=>{parameters.push(value);value.callbacks?.onmessage?.(message({setupComplete:{}}));return sessions[parameters.length-1];});
    let snapshot:ConsoleSnapshot=initialSnapshot;const console=controller(value=>snapshot=value);const starting=console.connect();
    await vi.waitFor(()=>expect(snapshot.connection).toBe('connected'));parameters[0].callbacks?.onmessage?.(message({goAway:{timeLeft:'1s'}}));
    await vi.waitFor(()=>expect(parameters).toHaveLength(2),{timeout:1500});
    await console.toggleMicrophone();await console.toggleMicrophone();release(stream);await starting;
    expect(snapshot.microphone).toBe('paused');expect(hardware.track.enabled).toBe(false);expect(hardware.track.stop).not.toHaveBeenCalled();
    const pcm=new MessageEvent<ArrayBuffer>('message',{data:new Uint8Array([16,0]).buffer});hardware.worklets[0].port.onmessage?.(pcm);
    expect(sessions[1].sendRealtimeInput).not.toHaveBeenCalledWith({audio:{data:'EAA=',mimeType:'audio/pcm;rate=16000'}});
    await console.toggleMicrophone();hardware.worklets[0].port.onmessage?.(pcm);
    expect(sessions[1].sendRealtimeInput).toHaveBeenCalledWith({audio:{data:'EAA=',mimeType:'audio/pcm;rate=16000'}});
  });
});

describe('console language interface',()=>{
  it('renders English controls and passes the language to the shop app',()=>{
    browser('?lang=en');const html=renderToStaticMarkup(createElement(App));
    expect(html).toContain('App help');expect(html).toContain('Start talking');expect(html).toContain('Your problem report');
    expect(html).toContain('http://127.0.0.1:4301/?lang=en');expect(html).toContain('aria-pressed="true" lang="en"');
    expect(html).not.toContain('बात शुरू करें');
  });
  it('keeps the default Hindi interface and an accessible English option',()=>{
    browser();const html=renderToStaticMarkup(createElement(App));
    expect(html).toContain('बात शुरू करें');expect(html).toContain('aria-pressed="false" lang="en"');
  });
  it('selects English report fields and consent indicators while retaining original evidence',()=>{
    const html=renderToStaticMarkup(createElement(ReportCard,{snapshot:{...initialSnapshot,language:'en',report,readbackComplete:true,turns:resumed.turns as ConsoleSnapshot['turns']}}));
    expect(html).toContain('Stock increased');expect(html).toContain('13 kg remains');expect(html).toContain('27 kg shown');expect(html).toContain('Sell 7 kg');
    expect(html).toContain('Start the fix');expect(html).not.toContain('स्टॉक बढ़ गया');
    expect(report.summary_hi).toBe('स्टॉक बढ़ गया');
  });
  it('localizes job progress and feedback fields for English readers',()=>{
    const html=renderToStaticMarkup(createElement(JobCard,{job,language:'en',onCancel:()=>{}}));
    expect(html).toContain('The agent is reproducing the problem and finding a fix.');expect(html).toContain('Stop the fix');
    const feedback=renderToStaticMarkup(createElement(FrictionDrawer,{language:'en',onClose:()=>{},onSave:async()=>{},evidenceIds:['evidence-1']}));
    expect(feedback).toContain('Observed problem');expect(feedback).toContain('What should have happened?');expect(feedback).not.toContain('क्या हुआ?');
  });
  it('shows received consent as confirmed for a durable repair after a language switch',()=>{
    const html=renderToStaticMarkup(createElement(ReportCard,{snapshot:{...initialSnapshot,language:'en',report,job,readbackComplete:false}}));
    expect(html).toContain('class="report-ready "');expect(html).toContain('Your permission was received.');
  });
});
