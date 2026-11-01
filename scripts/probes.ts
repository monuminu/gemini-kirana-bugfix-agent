import {config} from 'dotenv';
import {mkdir,writeFile} from 'node:fs/promises';
import {GoogleGenAI,Modality} from '@google/genai';
import {GoogleProvider,MODELS} from '../src/server/provider.js';
import type {BugBrief,TranscriptTurn} from '../src/shared/types.js';
config({path:'.env.local',quiet:true});
const key=process.env.GEMINI_API_KEY||'';
if(!key)throw new Error('Set GEMINI_API_KEY in private .env.local.');
const provider=new GoogleProvider(key);
const observations:Array<Record<string,unknown>>=[];
const safe=(e:unknown)=>String(e instanceof Error?e.message:e).replaceAll(key,'[REDACTED]').slice(0,1600);
async function probe(name:string,expected:string,fn:()=>Promise<unknown>){const start=Date.now();let observation:Record<string,unknown>={name,expected,timestamp:new Date(start).toISOString()};try{observation={...observation,actual:await fn()};}catch(error){observation={...observation,error:safe(error)};}observation.duration_ms=Date.now()-start;observations.push(observation);console.log(JSON.stringify(observation));await mkdir('work/probes',{recursive:true});await writeFile('work/probes/results.json',JSON.stringify({sdk:'2.31.0',model:MODELS.structured,observations},null,2),{mode:0o600});}
function summarize(result:any){return{status:result.status,interaction_id:result.id,output_text:result.output_text,tool_steps:(result.steps??[]).filter((s:any)=>/^(google_search|url_context)_(call|result)$/.test(s.type)).map(({signature,...step}:any)=>step),citations:(result.steps??[]).flatMap((s:any)=>(s.content??[]).flatMap((c:any)=>c.annotations??[]))};}
for(const [name,input,tools,expected] of [
 ['search_grounding','Search official Gemini documentation for whether Live API supports URL context. Answer in one sentence with sources.',[{type:'google_search'}],'Search call/result steps and source citations.'],
 ['url_public','Use URL context to read https://aistudio.google.com/docs/url-context.md. State the documented tool type in one sentence and cite the page.',[{type:'url_context'}],'Public document fetched with URL retrieval metadata.'],
 ['url_unavailable','Use URL context to fetch https://kirana-unavailable-fixture.invalid/stock. If unavailable, report that explicitly; do not invent its contents.',[{type:'url_context'}],'Unavailable URL reported; no invented stock data.'],
 ['url_private','Use URL context to read https://github.com/settings/profile. This is an authentication-gated account settings page; do not guess private profile fields. Explain whether you can access its contents.',[{type:'url_context'}],'Authentication-gated content unavailable; no invented private fields.']
] as const){await probe(name,expected,async()=>summarize(await provider.client.interactions.create({model:MODELS.structured,input,tools:[...tools],store:false},{timeout_ms:30000,retries:{strategy:'none'}})));}
const turn=(text:string,sequence:number,role:'user'|'model'='user'):TranscriptTurn=>({id:'fixture-'+sequence,role,text,sequence,finalized:true,created_at:new Date().toISOString()});
const initial=turn('मैंने दो किलो चीनी बेची। स्टॉक 15 से 17 किलो हो गया। इसे कम होना चाहिए था।',1);
let brief:BugBrief|undefined;
await probe('hindi_quantity_correction','Latest Hindi correction changes sale quantity to 2.5 kg; no assumption of approval.',async()=>{const content=await provider.createBrief([initial,turn('दो नहीं, ढाई किलो चीनी बेची थी। पहले 15 किलो था; अब 17.5 है। 12.5 किलो बचना चाहिए।',2)],[]);return{valid:true,content};});
await probe('hinglish_product','Preserve chini/sugar and 2 kg, 15/17/13 across faithful Hindi-English brief.',async()=>{const content=await provider.createBrief([turn('Maine 2 kilo chini bechi, stock 15 se 17 ho gaya. 13 kilo bachna chahiye.',1)],[]);brief={...content,id:'fixture',session_id:'fixture',version:1,repository:'monuminu/kirana-saathi-demo',base_sha:'0'.repeat(40),base_branch:'main',created_at:new Date().toISOString()};return{valid:true,content};});
if(brief){const readback=turn('आपने 15 किलो चीनी में से 2 किलो बेची, लेकिन ऐप में 17 किलो दिखा। 13 किलो बचना चाहिए। क्या मैं इसे सुधारने का काम शुरू कर दूँ?',2,'model');for(const [name,text,expected] of [
 ['consent_explicit','हाँ, आपने सही समझा। इसे ठीक कर दीजिए।','approve'],
 ['consent_symptom_agreement','हाँ, स्टॉक गलत है।','unclear'],
 ['consent_quantity_correction','दो नहीं, ढाई किलो था।','correction'],
 ['consent_refusal','नहीं, अभी सुधार शुरू मत कीजिए।','reject']
])await probe(name,expected,()=>provider.classifyConsent(brief!,turn(text,3),[initial,readback]));}
await probe('malformed_schema','Structured-output request rejects an invalid schema with a developer-readable error.',()=>provider.client.interactions.create({model:MODELS.structured,input:'Return a fixture value.',store:false,response_format:{type:'text',mime_type:'application/json',schema:{type:'definitely_not_json_schema'}}},{timeout_ms:15000,retries:{strategy:'none'}}));
await probe('expired_ephemeral_token','An unused Live token cannot start a session after its new-session deadline.',async()=>{
 const token=await provider.client.authTokens.create({config:{uses:1,newSessionExpireTime:new Date(Date.now()+2500).toISOString(),expireTime:new Date(Date.now()+60000).toISOString(),liveConnectConstraints:{model:MODELS.live,config:{responseModalities:[Modality.AUDIO]}}}});
 await new Promise(r=>setTimeout(r,4000));
 const client=new GoogleGenAI({apiKey:token.name,httpOptions:{apiVersion:'v1beta'}});
 return new Promise(async resolve=>{let session:any;let timer:ReturnType<typeof setTimeout>;const finish=(value:unknown)=>{clearTimeout(timer);session?.close();resolve(value);};timer=setTimeout(()=>finish({timeout:true}),10000);try{session=await client.live.connect({model:MODELS.live,config:{responseModalities:[Modality.AUDIO]},callbacks:{onmessage:m=>finish({unexpected_message_received:true}),onerror:e=>finish({rejected:true,error:safe(e)}),onclose:e=>finish({closed:true,code:e.code,reason:e.reason})}});session.sendRealtimeInput({text:'Token expiry fixture. Reply only hello.'});}catch(e){finish({rejected:true,error:safe(e)});}});
});
console.log('Probe results saved privately to work/probes/results.json. Quota exhaustion and physical microphone conditions were not induced.');
