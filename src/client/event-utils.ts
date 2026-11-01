import type { FunctionCall, Transcription } from '@google/genai';

export type ClientTurn = { id:string; role:'user'|'model'; text:string; sequence:number; finalized:boolean };
type LiveEventLike = {
  serverContent?: { modelTurn?: { parts?: { inlineData?: { data?:string;mimeType?:string }; text?:string;thought?:boolean }[] }; inputTranscription?:Transcription;outputTranscription?:Transcription;turnComplete?:boolean;interrupted?:boolean };
  toolCall?: { functionCalls?:FunctionCall[] }; toolCallCancellation?:{ids?:string[]};
  sessionResumptionUpdate?:{resumable?:boolean;newHandle?:string};goAway?:{timeLeft?:string};
};
export function extractLiveEvent(event: LiveEventLike) {
  const content = event.serverContent;
  return {
    audio:(content?.modelTurn?.parts ?? []).flatMap(part => part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm') ? [part.inlineData.data] : []),
    input:content?.inputTranscription,output:content?.outputTranscription,
    turnComplete:content?.turnComplete === true,interrupted:content?.interrupted === true,
    toolCalls:event.toolCall?.functionCalls ?? [],cancelledCallIds:event.toolCallCancellation?.ids ?? [],
    resumption:event.sessionResumptionUpdate,goAway:event.goAway,
  };
}
export class TurnAccumulator {
  private active = new Map<ClientTurn['role'],ClientTurn>();
  private nextSequence = 0;
  constructor(private idFactory: () => string = () => crypto.randomUUID()) {}
  seedSequence(sequence:number):void {this.nextSequence=Math.max(this.nextSequence,sequence);}
  append(role:ClientTurn['role'],text:string,finalized:boolean):ClientTurn {
    let turn = this.active.get(role);
    if (!turn || turn.finalized) turn = {id:this.idFactory(),role,text:'',sequence:++this.nextSequence,finalized:false};
    const updated = {...turn,text:turn.text + text,sequence:turn.sequence,finalized};
    this.active.set(role,updated);
    return {...updated};
  }
  finalize(role:ClientTurn['role']):ClientTurn | undefined {
    const turn = this.active.get(role);
    if (!turn || turn.finalized) return undefined;
    const updated = {...turn,sequence:turn.sequence,finalized:true};
    this.active.set(role,updated);
    return {...updated};
  }
  current(role:ClientTurn['role']):ClientTurn | undefined {
    const turn = this.active.get(role);
    return turn ? {...turn} : undefined;
  }
}
export class ToolCallLedger {
  private states = new Map<string,'pending'|'responded'|'cancelled'>();
  isPending(id:string):boolean {return this.states.get(id)==='pending';}
  begin(id:string):boolean { if(this.states.has(id))return false;this.states.set(id,'pending');return true; }
  claimResponse(id:string):boolean { if(this.states.get(id)!=='pending')return false;this.states.set(id,'responded');return true; }
  cancel(ids:string[]):void { for(const id of ids)this.states.set(id,'cancelled'); }
}
export class ModelTurnGate {
  private id?:string;
  private complete=false;
  begin(id:string):void { if(this.id!==id){this.id=id;this.complete=false;} }
  serverComplete(drained:boolean):string | undefined { this.complete=true;return drained ? this.speakerDrained() : undefined; }
  speakerDrained():string | undefined { if(!this.complete || !this.id)return undefined;const id=this.id;this.id=undefined;this.complete=false;return id; }
  interrupt():void { this.id=undefined;this.complete=false; }
}
