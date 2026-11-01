import {config} from 'dotenv';
import {mkdir,writeFile} from 'node:fs/promises';
import {GoogleGenAI} from '@google/genai';
import {GoogleProvider} from '../src/server/provider.js';
config({path:'.env.local',quiet:true});
const key=process.env.GEMINI_API_KEY||'';
if(!key)throw new Error('Set GEMINI_API_KEY in local .env.local.');
const provider=new GoogleProvider(key);
const results:Array<Record<string,unknown>>=[];
for(const language of ['hi','en'] as const){
 const token=await provider.liveToken(language);
 const client=new GoogleGenAI({apiKey:token.token,httpOptions:{apiVersion:'v1beta'}});
 let transcript='',audioBytes=0;let finish:()=>void=()=>{};let failure:string|undefined;
 const completed=new Promise<void>(r=>finish=r);
 const session=await client.live.connect({model:token.model,config:token.config as any,callbacks:{onmessage:m=>{transcript+=m.serverContent?.outputTranscription?.text??'';for(const part of m.serverContent?.modelTurn?.parts??[])if(part.inlineData?.data)audioBytes+=Buffer.from(part.inlineData.data,'base64').length;if(m.serverContent?.turnComplete)finish();},onerror:e=>{failure=String(e).replaceAll(key,'[REDACTED]');finish();},onclose:()=>finish()}});
 session.sendRealtimeInput({text:language==='en'?'Hello. In one short English sentence, introduce yourself as my shop app support. Do not call any tools.':'नमस्ते। एक छोटे हिंदी वाक्य में दुकान के ऐप की सहायता के रूप में अपना परिचय दें। कोई उपकरण न बुलाएँ।'});
 const timer=setTimeout(()=>{failure='Timed out';finish();},25000);
 await completed;clearTimeout(timer);session.close();
 const passed=!failure&&audioBytes>0&&(language==='en'?/[a-zA-Z]{3}/.test(transcript):/[\u0900-\u097f]/.test(transcript));
 results.push({language,passed,audio_bytes:audioBytes,transcript,error:failure,timestamp:new Date().toISOString()});
 console.log(JSON.stringify({language,passed,audio_bytes:audioBytes,error:failure}));
}
await mkdir('work/language',{recursive:true});await writeFile('work/language/live-probe.json',JSON.stringify(results,null,2),{mode:0o600});
if(results.some(r=>!r.passed))process.exitCode=1;
