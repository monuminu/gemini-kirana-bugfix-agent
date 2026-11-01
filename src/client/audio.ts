import workletUrl from './pcm-worklet.ts?worker&url';
import { base64ToBytes, decodePcm16 } from './audio-utils.js';

export class SpeakerQueue {
  private context:AudioContext;
  private sources = new Set<AudioBufferSourceNode>();
  private nextTime=0;
  constructor(private onSpeaking:(speaking:boolean)=>void,private onDrained:()=>void) {
    this.context = new AudioContext({sampleRate:24000});
  }
  async resume():Promise<void>{await this.context.resume();}
  get drained():boolean{return this.sources.size===0;}
  enqueue(base64:string):void {
    const samples=decodePcm16(base64ToBytes(base64));
    if(samples.length===0)return;
    const buffer=this.context.createBuffer(1,samples.length,24000);
    buffer.copyToChannel(new Float32Array(samples),0);
    const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.context.destination);
    this.sources.add(source);this.onSpeaking(true);
    source.onended=()=>{this.sources.delete(source);source.disconnect();if(this.drained){this.onSpeaking(false);this.onDrained();}};
    const start=Math.max(this.nextTime,this.context.currentTime+0.02);source.start(start);this.nextTime=start+buffer.duration;
  }
  clear():void{for(const source of this.sources){source.onended=null;try{source.stop();}catch{}source.disconnect();}this.sources.clear();this.nextTime=this.context.currentTime;this.onSpeaking(false);}
  close():void{this.clear();void this.context.close();}
}

export class MicrophoneCapture {
  private stream?:MediaStream;
  private context?:AudioContext;
  private node?:AudioWorkletNode;
  private source?:MediaStreamAudioSourceNode;
  private gain?:GainNode;
  private stopped=false;
  async start(onPcm:(bytes:Uint8Array)=>void):Promise<void>{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    if(this.stopped){stream.getTracks().forEach(track=>track.stop());return;}
    this.stream=stream;const context=new AudioContext();this.context=context;
    await context.audioWorklet.addModule(workletUrl);
    if(this.stopped){this.stop();return;}
    this.node=new AudioWorkletNode(context,'pcm-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
    this.node.port.onmessage=event=>{if(!this.stopped)onPcm(new Uint8Array(event.data));};
    this.source=context.createMediaStreamSource(stream);this.gain=context.createGain();this.gain.gain.value=0;
    this.source.connect(this.node);this.node.connect(this.gain);this.gain.connect(context.destination);await context.resume();
  }
  setEnabled(enabled:boolean):void{this.stream?.getAudioTracks().forEach(track=>{track.enabled=enabled;});this.node?.port.postMessage({enabled});}
  stop():void{this.stopped=true;this.stream?.getTracks().forEach(track=>track.stop());if(this.node)this.node.port.onmessage=null;this.source?.disconnect();this.node?.disconnect();this.gain?.disconnect();if(this.context && this.context.state!=='closed')void this.context.close();this.stream=undefined;}
}
