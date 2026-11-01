import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveServerMessage } from '@google/genai';
import { LiveConsole, initialSnapshot, type ConsoleSnapshot } from '../src/client/live-console.js';
import type { BugBrief, FixJob, TranscriptTurn } from '../src/shared/types.js';

const config = { repository:'monuminu/kirana-saathi-demo',baseBranch:'main',demoUrl:'http://127.0.0.1:4301',configured:{gemini:true,github:true},models:{live:'gemini-3.8-live',structured:'gemini-3.8-flash',agent:'antigravity-preview-09-2026'} };
const report:BugBrief = { id:'report-1',session_id:'session-1',version:2,summary_hi:'चावल बेचने पर स्टॉक बढ़ता है',summary_en:'Stock increases after a rice sale',reproduction_hi:['20 किलो में से 7 किलो चावल बेचें'],reproduction_en:['Sell 7 kg from 20 kg rice'],expected_hi:'13 किलो बचना चाहिए',actual_hi:'27 किलो दिखता है',expected_en:'13 kg should remain',actual_en:'27 kg is shown',quantities:[{label:'rice',value:20,unit:'kg'}],evidence_ids:['evidence-1'],repository:'monuminu/kirana-saathi-demo',base_sha:'a'.repeat(40),base_branch:'main',created_at:'2026-11-01T13:00:00Z' };
const job:FixJob = { id:'job-1',session_id:'session-1',report_id:'report-1',status:'running',stage:'repairing',message_hi:'सुधार का काम चल रहा है',attempt:1,created_at:'2026-11-01T13:01:00Z',updated_at:'2026-11-01T13:02:00Z',deadline_at:'2026-11-01T13:16:00Z' };
const turns:TranscriptTurn[] = [{id:'user-1',role:'user',text:'7 किलो चावल बेचने पर स्टॉक बढ़ता है',sequence:4,finalized:true,created_at:'2026-11-01T13:00:00Z'},{id:'model-1',role:'model',text:'13 किलो बचना चाहिए। क्या सुधार शुरू कर दूँ?',sequence:6,finalized:true,created_at:'2026-11-01T13:00:10Z'}];
const resumed = {sessionId:'session-1',csrfToken:'rotated-csrf',report,job,turns,evidence_ids:['evidence-1','evidence-2']};

afterEach(()=>vi.unstubAllGlobals());

/** Only the browser's external SSE transport is replaced; LiveConsole stays real. */
function installEventTransport(){
  const streams:Array<{url:string;onmessage:((event:MessageEvent<string>)=>void)|null;close:()=>void}>=[];
  class EventSourceTransport {
    onmessage:((event:MessageEvent<string>)=>void)|null=null;
    onerror:(()=>void)|null=null;
    constructor(readonly url:string){streams.push(this);}
    close():void{}
  }
  vi.stubGlobal('EventSource',EventSourceTransport);
  return {send:(job:FixJob)=>{const stream=streams.find(item=>item.url===`/api/jobs/${job.id}/events`);if(!stream)throw new Error('No subscribed job stream.');stream.onmessage?.(new MessageEvent('message',{data:JSON.stringify(job)}));}};
}

describe('console reload recovery',()=>{
  it('restores the durable conversation without starting Live audio',async()=>{
    installEventTransport();
    const paths:string[]=[];
    vi.stubGlobal('fetch',async(path:string)=>{paths.push(path);return Response.json(path==='/api/config'?config:resumed);});
    let snapshot:ConsoleSnapshot=initialSnapshot;
    const console=new LiveConsole(value=>{snapshot=value;});
    await console.initialize();
    expect(snapshot.report?.summary_hi).toBe('चावल बेचने पर स्टॉक बढ़ता है');
    expect(snapshot.turns.map(turn=>[turn.id,turn.text,turn.sequence])).toEqual([
      ['user-1','7 किलो चावल बेचने पर स्टॉक बढ़ता है',4],['model-1','13 किलो बचना चाहिए। क्या सुधार शुरू कर दूँ?',6],
    ]);
    expect(snapshot.evidenceIds).toEqual(['evidence-1','evidence-2']);
    expect(snapshot.evidenceCount).toBe(2);
    expect(snapshot.connection).toBe('idle');
    expect(snapshot.microphone).toBe('off');
    expect(snapshot.error).toBeUndefined();
    expect(paths).toEqual(['/api/config','/api/sessions']);
    console.destroy();
  });

  it('shares one session-resume request across concurrent bootstrap consumers',async()=>{
    let sessionRequests=0;
    let release!:(response:Response)=>void;
    const sessionResponse=new Promise<Response>(resolve=>{release=resolve;});
    vi.stubGlobal('fetch',async(path:string)=>{if(path==='/api/config')return Response.json(config);sessionRequests++;return sessionResponse;});
    const console=new LiveConsole(()=>{});
    const first=console.initialize();
    const second=console.initialize();
    await Promise.resolve();
    release(Response.json({...resumed,job:undefined}));
    await Promise.all([first,second]);
    expect(sessionRequests).toBe(1);
    console.destroy();
  });

  it('reattaches the restored active job and renders later verified status',async()=>{
    const transport=installEventTransport();
    vi.stubGlobal('fetch',async(path:string)=>Response.json(path==='/api/config'?config:resumed));
    let snapshot:ConsoleSnapshot=initialSnapshot;
    const console=new LiveConsole(value=>{snapshot=value;});
    await console.initialize();
    expect(snapshot.job?.status).toBe('running');
    transport.send({...job,status:'completed',message_hi:'सुधार तैयार है',preview_url:'http://127.0.0.1:4310',pr_url:'https://github.com/monuminu/kirana-saathi-demo/pull/1'});
    expect(snapshot.job?.status).toBe('completed');
    expect(snapshot.job?.preview_url).toBe('http://127.0.0.1:4310');
    expect(snapshot.job?.pr_url).toBe('https://github.com/monuminu/kirana-saathi-demo/pull/1');
    console.destroy();
  });

  it('cancels a restored job while voice is offline using rotated CSRF',async()=>{
    installEventTransport();
    let cancellation:RequestInit | undefined;
    vi.stubGlobal('fetch',async(path:string,request:RequestInit)=>{
      if(path==='/api/config')return Response.json(config);
      if(path==='/api/sessions')return Response.json(resumed);
      if(path==='/api/sessions/session-1/tools/cancel_bug_fix'){cancellation=request;return Response.json({...job,status:'cancelled',message_hi:'सुधार रोक दिया गया'});}
      throw new Error(`Unexpected request: ${path}`);
    });
    let snapshot:ConsoleSnapshot=initialSnapshot;
    const console=new LiveConsole(value=>{snapshot=value;});
    await console.initialize();
    await console.cancelJob();
    expect(snapshot.connection).toBe('idle');
    expect(snapshot.job?.status).toBe('cancelled');
    expect(cancellation?.headers).toEqual({'Content-Type':'application/json','X-CSRF-Token':'rotated-csrf'});
    expect(JSON.parse(String(cancellation?.body)).args).toEqual({job_id:'job-1'});
    console.destroy();
  });

  it('persists the next Live turn after the largest restored turn position',async()=>{
    installEventTransport();
    const postedEvents:Array<{type:string;turn:{text:string;sequence:number;finalized:boolean}}>=[];
    vi.stubGlobal('fetch',async(path:string,request:RequestInit)=>{
      if(path==='/api/config')return Response.json(config);
      if(path==='/api/sessions')return Response.json(resumed);
      if(path==='/api/sessions/session-1/events'){postedEvents.push(JSON.parse(String(request.body)));return Response.json({ok:true});}
      throw new Error(`Unexpected request: ${path}`);
    });
    const console=new LiveConsole(()=>{});
    await console.initialize();
    const message=new LiveServerMessage();
    message.serverContent={inputTranscription:{text:'एक और बात',finished:true}};
    // Exercise the same server-message entry used by the SDK callback.
    console['handleMessage'](message);
    await vi.waitFor(()=>expect(postedEvents).toHaveLength(1));
    expect(postedEvents[0].type).toBe('transcript');
    expect(postedEvents[0].turn.sequence).toBe(7);
    expect(postedEvents[0].turn.text).toBe('एक और बात');
    expect(postedEvents[0].turn.finalized).toBe(true);
    console.destroy();
  });
});
