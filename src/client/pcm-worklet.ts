import { encodePcm16, StreamingResampler } from './audio-utils.js';

declare const sampleRate:number;
declare class AudioWorkletProcessor { readonly port:MessagePort; }
declare function registerProcessor(name:string,processor:typeof AudioWorkletProcessor):void;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  private resampler = new StreamingResampler(sampleRate,16000);
  private pending:number[] = [];
  private enabled=true;
  constructor() { super();this.port.onmessage = event => { this.enabled=event.data.enabled !== false;if(!this.enabled)this.pending=[]; }; }
  process(inputs:Float32Array[][]):boolean {
    const channels=inputs[0];
    if(!this.enabled || !channels?.[0])return true;
    const mono=new Float32Array(channels[0].length);
    for(const channel of channels)for(let i=0;i<mono.length;i++)mono[i]+=channel[i]/channels.length;
    this.pending.push(...this.resampler.push(mono));
    while(this.pending.length>=320){const bytes=encodePcm16(new Float32Array(this.pending.splice(0,320)));this.port.postMessage(bytes.buffer,[bytes.buffer]);}
    return true;
  }
}
registerProcessor('pcm-capture',PcmCaptureProcessor);
