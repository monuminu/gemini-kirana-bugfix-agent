import type {FixJob} from '../shared/types.js';
/** Operator recovery after publication: no new agent, report, branch or PR. */
export function previewRecovery(job:FixJob,now=Date.now()):Partial<FixJob>{
 if(!['needs_attention','failed'].includes(job.status)||!job.pr_url||!job.pr_number||!job.branch||!job.commit_sha||!/^[a-f0-9]{40}$/.test(job.commit_sha))throw new Error('Only a failed preview with a complete saved publication can resume. Cancelled, active and completed jobs cannot resume.');
 return {status:'previewing',stage:'resuming_published_patch',message_hi:'सहेजे हुए सुधार का प्रीव्यू फिर जाँच रहे हैं।',error:undefined,deadline_at:new Date(now+900_000).toISOString(),preview_recovery:{requested_at:new Date(now).toISOString(),original_deadline_at:job.preview_recovery?.original_deadline_at??job.deadline_at}};
}
