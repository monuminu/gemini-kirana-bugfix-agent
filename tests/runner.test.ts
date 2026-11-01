import { describe, expect, it } from 'vitest';
import { pendingPublishCalls, managedAgentRequest, safePatchPath } from '../src/server/runner';
const config = {apiKey:'secret-api',githubToken:'secret-github',repository:'owner/repo',baseBranch:'main',workDir:'/tmp/job',agentModel:'antigravity-preview-09-2026',timeoutMs:900000,maxRevisions:2,previewPort:4310};
describe('managed interaction contract', () => {
  it('only dispatches unfulfilled publication functions', () => {
    const steps:any[]=[{type:'function_call',id:'filesystem',name:'write_to_file',arguments:{}},{type:'function_call',id:'done',name:'publish_patch',arguments:{}},{type:'function_result',call_id:'done',name:'publish_patch',result:{}},{type:'function_call',id:'pending',name:'publish_patch',arguments:{patch_path:'/workspace/fix.patch'}}];
    expect(pendingPublishCalls({steps})).toHaveLength(1);
    expect(pendingPublishCalls({steps})[0].id).toBe('pending');
  });
  it('re-specifies tools and the same environment when continuing', () => {
    const request = managedAgentRequest(config,'continue','env-known','interaction-known');
    expect(request).toMatchObject({agent:config.agentModel,background:true,store:true,environment:'env-known',previous_interaction_id:'interaction-known'});
    expect(request.tools).toEqual(expect.arrayContaining([expect.objectContaining({name:'publish_patch'})]));
    expect(JSON.stringify(request)).not.toMatch(/secret-api|secret-github/);
  });
  it('creates a public, restricted sandbox with no credential injection', () => {
    const request = managedAgentRequest(config,'fix');
    expect(request.environment).toMatchObject({type:'remote',sources:[{type:'repository',source:'https://github.com/owner/repo.git',target:'/workspace/repo'}]});
    expect(JSON.stringify(request.environment)).not.toMatch(/credential|transform|secret/);
  });
  it('limits downloaded artifacts to the one declared patch file', () => {
    expect(safePatchPath('/workspace/fix.patch')).toBe('workspace/fix.patch');
    expect(() => safePatchPath('/etc/passwd')).toThrow();
    expect(() => safePatchPath('/workspace/../etc/passwd.patch')).toThrow();
  });
});

import { afterEach, beforeEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runJobWithDependencies } from '../src/server/runner';
import type { FixJob, BugBrief, RunnerHooks } from '../src/shared/types';
let directory:string;
beforeEach(async()=>{directory=await mkdtemp(path.join(tmpdir(),'kirana-runner-'));});
afterEach(async()=>{await rm(directory,{recursive:true,force:true});});
function fixture(overrides:Partial<FixJob>={}) {
  let current:FixJob={id:'job-123',session_id:'session-1',report_id:'report-1',status:'queued',stage:'queued',message_hi:'',attempt:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),deadline_at:new Date(Date.now()+900000).toISOString(),...overrides};
  const report:BugBrief={id:'report-1',session_id:'session-1',version:1,summary_hi:'चीनी गलत है',summary_en:'Sugar remaining stock is wrong',reproduction_hi:[],reproduction_en:[],expected_hi:'13 किलो',actual_hi:'17 किलो',expected_en:'13kg',actual_en:'17kg',quantities:[],evidence_ids:[],repository:'owner/repo',base_sha:'a'.repeat(40),base_branch:'main',created_at:new Date().toISOString()};
  const hooks:RunnerHooks={get:()=>current,update:patch=>{current={...current,...patch};},isCancelled:()=>current.status==='cancelled'};
  const interaction:any={id:'interaction-known',environment_id:'env-known',status:'requires_action',steps:[{type:'function_call',id:'submit-1',name:'publish_patch',arguments:{patch_path:'/workspace/fix.patch',requested_summary:'Correct stock'}}]};
  const client:any={interactions:{create:vi.fn(async()=>interaction),get:vi.fn(async()=>interaction),cancel:vi.fn(async()=>({status:'cancelled'}))},environments:{files:{list:vi.fn(async()=>({files:[{path:'workspace/fix.patch',size_bytes:'5',type:'file'}]})),download:vi.fn(async()=>Buffer.from('patch'))}}};
  const verified:any={verification:{checks:[{command:'npm test',exit_code:0},{command:'npm run typecheck',exit_code:0},{command:'npm run build',exit_code:0}],baseline_failed:true,source_sha:report.base_sha,artifact_sha:'b'.repeat(64)},files:[{path:'src/inventory.ts',content:'fix'}]};
  const deps:any={client,verify:vi.fn(async()=>verified),publish:vi.fn(async()=>({branch:'bugfix/kirana/job-123',commit_sha:'c'.repeat(40),pr_number:1,pr_url:'https://github.com/owner/repo/pull/1'})),preview:vi.fn(async()=> 'http://127.0.0.1:4310/'),browserCheck:vi.fn(async()=>undefined),stopPreview:vi.fn(async()=>undefined)};
  return {job:current,report,hooks,deps,get:()=>current,config:{...config,workDir:directory}};
}
describe('repair lifecycle safety',()=>{
  it('rechecks a user-requested preview UI revision at its recorded updated base without new repair or publication',async()=>{const f=fixture({status:'previewing',stage:'resuming_published_patch',interaction_id:'known',pr_url:'https://github.com/owner/repo/pull/1',pr_number:1,commit_sha:'c'.repeat(40),branch:'bugfix/kirana/job-123',preview_revision:{reason:'audience_language_switch',updated_at:new Date().toISOString(),base_sha:'d'.repeat(40),commit_sha:'c'.repeat(40),original_commit_sha:'e'.repeat(40)}});await mkdir(path.join(directory,f.job.id));await writeFile(path.join(directory,f.job.id,'candidate.patch'),'patch');await runJobWithDependencies(f.job,f.report,[],[],f.config,f.hooks,f.deps);expect(f.get().status).toBe('completed');expect(f.deps.verify).toHaveBeenCalledWith(f.config.repository,'d'.repeat(40),'patch',expect.any(String),expect.any(Object));expect(f.deps.publish).not.toHaveBeenCalled();expect(f.deps.client.interactions.create).not.toHaveBeenCalled();});
  it('recovers an immutable published preview after its original report was superseded without recreating an agent or PR',async()=>{const f=fixture({status:'previewing',stage:'resuming_published_patch',interaction_id:'known',pr_url:'https://github.com/owner/repo/pull/1',pr_number:1,commit_sha:'c'.repeat(40),branch:'bugfix/kirana/job-123'});f.report.invalidated=true;await mkdir(path.join(directory,f.job.id));await writeFile(path.join(directory,f.job.id,'candidate.patch'),'patch');await runJobWithDependencies(f.job,f.report,[],[],f.config,f.hooks,f.deps);expect(f.get().status).toBe('completed');expect(f.deps.verify).toHaveBeenCalled();expect(f.deps.browserCheck).toHaveBeenCalled();expect(f.deps.client.interactions.create).not.toHaveBeenCalled();expect(f.deps.client.interactions.get).not.toHaveBeenCalled();expect(f.deps.publish).not.toHaveBeenCalled();});
  it('resumes a known interaction, records verification and publication, and only completes after the browser check',async()=>{
    const f=fixture({status:'running',interaction_id:'interaction-known',environment_id:'env-known'});
    f.deps.client.interactions.create.mockResolvedValue({id:'ack',environment_id:'env-known',status:'completed',steps:[]});
    await runJobWithDependencies(f.job,f.report,[],[],f.config,f.hooks,f.deps);
    expect(f.deps.client.interactions.get).toHaveBeenCalledWith('interaction-known',{},expect.any(Object));
    expect(f.deps.client.interactions.create).toHaveBeenCalledTimes(1);
    expect(f.deps.client.interactions.create.mock.calls[0][0]).toMatchObject({previous_interaction_id:'interaction-known',environment:'env-known'});
    expect(f.deps.browserCheck).toHaveBeenCalled();expect(f.get().status).toBe('completed');
    expect(f.get().verification?.source_sha).toBe(f.report.base_sha);expect(f.get().pr_url).toContain('/pull/1');
  });
  it('never restarts an agent after an unknown create response',async()=>{
    const f=fixture();f.deps.client.interactions.create.mockRejectedValue(new Error('connection lost'));
    await runJobWithDependencies(f.job,f.report,[],[],f.config,f.hooks,f.deps);
    expect(f.get().status).toBe('needs_attention');expect(f.get().stage).toBe('create_outcome_unknown');
    await runJobWithDependencies(f.get(),f.report,[],[],f.config,f.hooks,f.deps);
    expect(f.deps.client.interactions.create).toHaveBeenCalledTimes(1);expect(f.deps.publish).not.toHaveBeenCalled();
  });
  it('stops after the initial candidate and two failed verification revisions',async()=>{
    const f=fixture();f.deps.verify.mockRejectedValue(new Error('Candidate regression still fails'));
    await runJobWithDependencies(f.job,f.report,[],[],f.config,f.hooks,f.deps);
    expect(f.deps.verify).toHaveBeenCalledTimes(3);expect(f.deps.client.interactions.create).toHaveBeenCalledTimes(3);
    expect(f.get().status).toBe('failed');expect(f.deps.publish).not.toHaveBeenCalled();
  });
  it('cancels a known provider job and starts no new interaction',async()=>{
    const f=fixture({status:'cancelled',interaction_id:'interaction-known'});
    await runJobWithDependencies(f.job,f.report,[],[],f.config,f.hooks,f.deps);
    expect(f.deps.client.interactions.cancel).toHaveBeenCalledWith('interaction-known',{},expect.any(Object));
    expect(f.deps.client.interactions.create).not.toHaveBeenCalled();expect(f.deps.publish).not.toHaveBeenCalled();expect(f.get().status).toBe('cancelled');
  });
  it('blocks restart of an unresolved continuation even when the previous interaction ID is known',async()=>{
    const f=fixture({status:'running',stage:'creating_interaction',interaction_id:'previous-known',environment_id:'env-known'});
    await runJobWithDependencies(f.job,f.report,[],[],f.config,f.hooks,f.deps);
    expect(f.get().status).toBe('needs_attention');expect(f.get().stage).toBe('create_outcome_unknown');
    expect(f.deps.client.interactions.get).not.toHaveBeenCalled();expect(f.deps.client.interactions.create).not.toHaveBeenCalled();expect(f.deps.publish).not.toHaveBeenCalled();
  });
  it('preserves cancellation that arrives while the initial create request is in flight',async()=>{
    const f=fixture();
    f.deps.client.interactions.create.mockImplementation(async()=>{f.hooks.update({status:'cancelled'});return {id:'created-during-cancel',environment_id:'env-known',status:'in_progress',steps:[]};});
    await runJobWithDependencies(f.job,f.report,[],[],f.config,f.hooks,f.deps);
    expect(f.get().status).toBe('cancelled');
    expect(f.deps.client.interactions.cancel).toHaveBeenCalledWith('created-during-cancel',{},expect.any(Object));
    expect(f.deps.publish).not.toHaveBeenCalled();
  });
  it('refuses to resume a job beyond its deadline and cancels its known interaction',async()=>{
    const f=fixture({interaction_id:'interaction-known',deadline_at:new Date(Date.now()-1).toISOString()});
    await runJobWithDependencies(f.job,f.report,[],[],f.config,f.hooks,f.deps);
    expect(f.get().status).toBe('failed');expect(f.get().stage).toBe('deadline_exceeded');
    expect(f.deps.client.interactions.cancel).toHaveBeenCalled();expect(f.deps.client.interactions.get).not.toHaveBeenCalled();
  });
  it('keeps a published PR visible when the static browser proof fails',async()=>{
    const f=fixture();f.deps.browserCheck.mockRejectedValue(new Error('13kg not shown'));
    await runJobWithDependencies(f.job,f.report,[],[],f.config,f.hooks,f.deps);
    expect(f.get().status).toBe('needs_attention');expect(f.get().pr_url).toContain('/pull/1');expect(f.get().preview_url).toBeUndefined();
  });
});
