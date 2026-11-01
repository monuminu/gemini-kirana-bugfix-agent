import {describe,it,expect} from 'vitest';
import {previewRecovery} from '../src/server/preview-recovery.js';
import type {FixJob} from '../src/shared/types.js';
const job:FixJob={id:'job',session_id:'s',report_id:'r',status:'needs_attention',stage:'published_preview_needs_attention',message_hi:'',attempt:1,created_at:'2026-11-01T07:00:00Z',updated_at:'2026-11-01T07:00:00Z',deadline_at:'2026-11-01T07:15:00Z',interaction_id:'provider-existing',environment_id:'environment-existing',pr_url:'https://github.com/monuminu/kirana-saathi-demo/pull/1',pr_number:1,branch:'bugfix/kirana/job',commit_sha:'a'.repeat(40),error:'missing browser'};
describe('operator preview recovery',()=>{
 it('resumes only the saved published patch with a bounded preview deadline',()=>{const p=previewRecovery(job,Date.parse('2026-11-01T08:00:00Z'));expect(p.status).toBe('previewing');expect(p.deadline_at).toBe('2026-11-01T08:15:00.000Z');expect(p.error).toBeUndefined();expect(p.preview_recovery?.original_deadline_at).toBe(job.deadline_at);expect(p).not.toHaveProperty('interaction_id');expect(p).not.toHaveProperty('commit_sha');});
 it.each(['cancelled','completed','running'] as const)('cannot resume a %s job',status=>expect(()=>previewRecovery({...job,status})).toThrow());
 it.each(['pr_url','pr_number','branch','commit_sha'] as const)('rejects missing publication field %s',field=>expect(()=>previewRecovery({...job,[field]:undefined})).toThrow());
});
