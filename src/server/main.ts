import {config as dotenv} from 'dotenv';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import express from 'express';
import {Store} from './store.js';
import {createApp} from './app.js';
import {MODELS} from './provider.js';
import type {RunnerConfig} from '../shared/types.js';
dotenv({path:'.env.local',quiet:true});
const workDir=path.resolve('work');mkdirSync(workDir,{recursive:true});
let githubToken=process.env.GITHUB_TOKEN||'';
if(!githubToken){try{githubToken=execFileSync('gh',['auth','token'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{/* GitHub configuration displayed in UI, no secret diagnostics. */}}
const cfg:RunnerConfig={apiKey:process.env.GEMINI_API_KEY||'',githubToken,repository:process.env.DEMO_REPOSITORY||'monuminu/kirana-saathi-demo',baseBranch:process.env.DEMO_BASE_BRANCH||'main',workDir,agentModel:MODELS.agent,timeoutMs:900000,maxRevisions:2,previewPort:4310};
if(!/^monuminu\/kirana-saathi-demo$/.test(cfg.repository))throw new Error('This local release permits only monuminu/kirana-saathi-demo.');
const store=new Store(path.join(workDir,'state.sqlite'));const app=createApp(cfg,store);if(process.env.NODE_ENV==='production'){app.use(express.static(path.resolve('dist/client')));app.get('/{*path}',(_req,res)=>res.sendFile(path.resolve('dist/client/index.html')));}
const port=Number(process.env.PORT||(process.env.NODE_ENV==='production'?4300:4302));const server=app.listen(port,'127.0.0.1',()=>console.log(`Kirana help API ready: http://127.0.0.1:${port} (Gemini ${cfg.apiKey?'configured':'missing'}, GitHub ${githubToken?'configured':'missing'})`));
function shutdown(){app.locals.shutdown();server.close(()=>{store.close();process.exit(0);});}process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
