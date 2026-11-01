import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {Store} from '../src/server/store.js';
import {verifyPatch,createPreview,checkPreview} from '../src/server/docker.js';
import {TERMINAL_STATUSES} from '../src/shared/types.js';
// Operator UI update after a human requested language controls; no managed repair or publication.
const [id,baseSha,commitSha]=process.argv.slice(2);
if(!id||!/^[a-f0-9-]{36}$/.test(id)||!baseSha||!commitSha||![baseSha,commitSha].every(s=>/^[a-f0-9]{40}$/.test(s)))throw new Error('Usage: npx tsx scripts/refresh-language-preview.ts <published-job-id> <updated-main-sha> <updated-pr-sha>');
const workDir=path.resolve('work');const store=new Store(path.join(workDir,'state.sqlite'));const job=store.getJob(id);
if(!job?.pr_url||!job.commit_sha||!job.verification||!TERMINAL_STATUSES.includes(job.status)||job.status==='cancelled')throw new Error('Expected an existing published, inactive repair.');
if(store.listJobs().some(j=>!TERMINAL_STATUSES.includes(j.status)))throw new Error('Another repair is active.');
const dir=path.join(workDir,'language-preview');await mkdir(dir,{recursive:true});
await writeFile(path.join(dir,'original-job.json'),JSON.stringify(job,null,2),{mode:0o600});
const patch=await readFile(path.join(workDir,id,'candidate.patch'),'utf8');
await cp(path.join(workDir,id,'package-cache'),path.join(dir,'package-cache'),{recursive:true});
store.updateJob(id,{status:'needs_attention',stage:'preview_language_update',message_hi:'भाषा बदलने वाले नए प्रीव्यू की जाँच हो रही है।'});
const signal=AbortSignal.timeout(900000);const control={signal,cancelled:()=>signal.aborted};
try{
 console.log('Verify the original arithmetic patch against the updated inventory UI.');
 const verified=await verifyPatch('monuminu/kirana-saathi-demo',baseSha,patch,dir,control);
 console.log('Build the exact updated PR commit and compare its artifact.');
 const preview=await createPreview('monuminu/kirana-saathi-demo',commitSha,dir,4310,verified,control);
 await checkPreview(preview,path.join(dir,'logs'),control);
 const revision={reason:'audience_language_switch' as const,updated_at:new Date().toISOString(),base_sha:baseSha,commit_sha:commitSha,original_commit_sha:job.preview_revision?.original_commit_sha??job.commit_sha,original_verification:job.preview_revision?.original_verification??job.verification};
 const current=store.updateJob(id,{status:'completed',stage:'preview_verified',message_hi:'सुधार तैयार है। जाँच में 15 किलो से 2 किलो बेचने पर 13 किलो बचता है।',commit_sha:commitSha,verification:verified.verification,preview_url:preview,preview_revision:revision,error:undefined});
 await writeFile(path.join(dir,'verification.json'),JSON.stringify({revision,verification:verified.verification,preview_url:preview,pr_url:job.pr_url},null,2),{mode:0o600});
 console.log(JSON.stringify({status:current.status,pr_url:current.pr_url,commit_sha:commitSha,artifact_sha:verified.verification.artifact_sha,preview_url:preview}));
}catch(error){store.updateJob(id,{status:'needs_attention',stage:'preview_language_update_failed',error:error instanceof Error?error.message:String(error)});throw error;}finally{store.close();}
