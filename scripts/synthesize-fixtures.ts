import {config} from 'dotenv';
import {GoogleGenAI} from '@google/genai';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
config({path:'.env.local',quiet:true});
const key=process.env.GEMINI_API_KEY||'';if(!key)throw new Error('GEMINI_API_KEY required.');
const client=new GoogleGenAI({apiKey:key});const out=path.resolve('work/voice-fixtures');await mkdir(out,{recursive:true});
const lines={report:'मैंने दो किलो चीनी बेची, लेकिन स्टॉक पंद्रह से सत्रह किलो हो गया। इसे तेरह किलो होना चाहिए था।',approval:'हाँ, आपने सही समझा। चीनी बेचने पर स्टॉक घटकर तेरह किलो होना चाहिए। इसे ठीक कर दीजिए।'};
for(const[name,text]of Object.entries(lines)){try{const r=await client.interactions.create({model:'gemini-3.8-flash-tts',input:[{type:'user_input',content:[{type:'text',text,annotations:[{type:'speech_metadata',style:'natural Indian Hindi shopkeeper, conversational and clear'}]}]}],store:false,response_format:{type:'audio'},generation_config:{speech_config:[{voice:'Kore'}]}},{timeout_ms:60000,retries:{strategy:'none'}});if(!r.output_audio?.data)throw new Error('No synthesized audio returned.');await writeFile(path.join(out,name+'.wav'),Buffer.from(r.output_audio.data,'base64'));console.log(name,'synthetic Hindi replay fixture ready.');}catch(e){console.error(String(e).replaceAll(key,'[REDACTED]'));process.exit(1);}}
