import path from 'node:path';
import {Store} from '../src/server/store.js';
import {previewRecovery} from '../src/server/preview-recovery.js';
import {TERMINAL_STATUSES} from '../src/shared/types.js';
const id=process.argv[2];
if(!id||!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('Usage: npm run resume-preview -- <published-job-id>');
const store=new Store(path.resolve('work/state.sqlite'));
try{store.db.exec('BEGIN IMMEDIATE');const job=store.getJob(id);if(!job)throw new Error('Job not found.');if(store.listJobs().some(j=>j.id!==id&&!TERMINAL_STATUSES.includes(j.status)))throw new Error('Another repair is active.');const next=store.updateJob(id,previewRecovery(job));store.db.exec('COMMIT');console.log(JSON.stringify({id:next.id,status:next.status,pr_url:next.pr_url,commit_sha:next.commit_sha,deadline_at:next.deadline_at,recovery:'Existing publication verification and preview only; no agent redispatch.'},null,2));}catch(e){try{store.db.exec('ROLLBACK');}catch{}throw e;}finally{store.close();}
