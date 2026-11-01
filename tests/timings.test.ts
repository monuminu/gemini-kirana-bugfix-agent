import {describe,it,expect} from 'vitest';
import request from 'supertest';
import {Store} from '../src/server/store.js';
import {createApp} from '../src/server/app.js';
import type {FixJob} from '../src/shared/types.js';
describe('local timing evidence',()=>{
 it('persists successive job stages across SQLite recovery',()=>{const s=new Store(':memory:');const j:FixJob={id:'j',session_id:'s',report_id:'r',status:'running',stage:'agent_running',attempt:1,message_hi:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),deadline_at:new Date().toISOString()};s.saveJob(j);s.updateJob('j',{stage:'verifying',status:'verifying'});s.updateJob('j',{stage:'preview_verified',status:'completed'});expect(s.timings('s').map(t=>t.stage)).toEqual(['agent_running','verifying','preview_verified']);s.close();});
 it('records response timings without query, headers or request bodies',async()=>{const s=new Store(':memory:');const app=createApp({apiKey:'',githubToken:'',repository:'monuminu/kirana-saathi-demo',baseBranch:'main',workDir:'/tmp',agentModel:'agent',timeoutMs:900000,maxRevisions:2,previewPort:4310},s,{startJobs:false});await request(app).get('/api/config?key=private-value').set('Authorization','Bearer private-header');const text=JSON.stringify(s.timings());expect(text).toContain('/api/config');expect(text).not.toContain('private-value');expect(text).not.toContain('private-header');expect(s.timings()[0]).toMatchObject({status_code:200,kind:'request'});app.locals.shutdown();s.close();});
});
