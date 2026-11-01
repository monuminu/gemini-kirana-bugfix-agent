import { Octokit } from '@octokit/rest';
import type { Verification } from '../shared/types.js';
import type { ChangedFile, Control } from './docker.js';

export type RepositoryConfig={repository:string;baseBranch:string;githubToken?:string};
export type PublishConfig=RepositoryConfig & {baseSha:string;jobId:string};
export type PublishedPatch={branch:string;commit_sha:string;pr_number:number;pr_url:string};
function repositoryParts(repository:string):{owner:string;repo:string} {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))throw new Error('Invalid GitHub repository.');
  const [owner,repo]=repository.split('/');return {owner,repo};
}
function githubClient(token?:string,signal?:AbortSignal):Octokit {return new Octokit({auth:token,request:{timeout:20_000,signal}});}
export async function getBaseSha(config:RepositoryConfig):Promise<string> {
  const {data}=await githubClient(config.githubToken).rest.git.getRef({...repositoryParts(config.repository),ref:`heads/${config.baseBranch}`});
  return data.object.sha;
}
export function buildPrBody(baseSha:string,verification:Verification):string {
  return `A synthetic Hindi shop report described an inventory error: starting with 15 kg of sugar and recording a 2 kg sale showed 17 kg. The expected remaining stock is 13 kg.\n\nThe production patch corrects the sale calculation while keeping the existing tests and build configuration unchanged.\n\nVerification against immutable baseline \`${baseSha}\`:\n\n- The baseline reproduced exactly the agreed sale regression; the other tests passed.\n${verification.checks.map(check=>`- \`${check.command}\`: exit ${check.exit_code}`).join('\n')}\n- Built artifact SHA-256: \`${verification.artifact_sha}\`\n\nThis draft needs human review before merge. No transcript, screenshots, or credentials are included.`;
}
function active(control:Control):void {if(control.cancelled?.()||control.signal?.aborted)throw new Error('Job cancelled; publication stopped.');}
function notFound(error:unknown):boolean {return Boolean(error&&typeof error==='object'&&'status' in error&&(error as {status:number}).status===404);}
export async function publishPatch(config:PublishConfig,files:ChangedFile[],verification:Verification,suppliedClient:Octokit|undefined=undefined,control:Control={}):Promise<PublishedPatch> {
  const client=suppliedClient??githubClient(config.githubToken,control.signal);
  if(!config.githubToken)throw new Error('GitHub server credential is required for publication.');
  if(!verification.baseline_failed||verification.source_sha!==config.baseSha||!verification.checks.length||verification.checks.some(c=>c.exit_code!==0))throw new Error('Independent verification must pass before publication.');
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(config.jobId))throw new Error('Invalid job ID.');
  if(!files.length||files.some(f=>!/^src\/[A-Za-z0-9_./-]+\.(?:tsx?|css)$/.test(f.path)||f.path.includes('..')||/\.(?:test|spec)\.|test[-_]setup/.test(f.path)))throw new Error('Publication contains forbidden paths.');
  const repo=repositoryParts(config.repository),branch=`bugfix/kirana/${config.jobId}`;
  const assertBase=async()=>{active(control);const {data}=await client.rest.git.getRef({...repo,ref:`heads/${config.baseBranch}`});if(data.object.sha!==config.baseSha)throw new Error('Repository base changed. Prepare and confirm a fresh bug brief.');};
  await assertBase();
  const {data:base}=await client.rest.git.getCommit({...repo,commit_sha:config.baseSha});
  const treeEntries=[];
  for(const file of files) {
    active(control);
    const {data:blob}=await client.rest.git.createBlob({...repo,content:Buffer.from(file.content).toString('base64'),encoding:'base64'});
    treeEntries.push({path:file.path,mode:'100644' as const,type:'blob' as const,sha:blob.sha});
  }
  active(control);
  const {data:tree}=await client.rest.git.createTree({...repo,base_tree:base.tree.sha,tree:treeEntries});
  async function existingBranch():Promise<string|undefined> {
    try {const {data}=await client.rest.git.getRef({...repo,ref:`heads/${branch}`});return data.object.sha;}catch(error){if(notFound(error))return;throw error;}
  }
  async function checkCommit(sha:string):Promise<void> {
    const {data}=await client.rest.git.getCommit({...repo,commit_sha:sha});
    if(data.tree.sha!==tree.sha||data.parents.length!==1||data.parents[0].sha!==config.baseSha)throw new Error('Existing job branch does not match this verified patch.');
  }
  let commitSha=await existingBranch();
  if(commitSha)await checkCommit(commitSha);
  else {
    await assertBase();active(control);
    const {data:commit}=await client.rest.git.createCommit({...repo,message:'Fix inventory remaining stock after sale',tree:tree.sha,parents:[config.baseSha]});
    commitSha=commit.sha;
    await assertBase();active(control);
    try {await client.rest.git.createRef({...repo,ref:`refs/heads/${branch}`,sha:commitSha});}
    catch(error) {const found=await existingBranch();if(!found)throw error;await checkCommit(found);commitSha=found;}
  }
  await assertBase();active(control);
  const {data:prs}=await client.rest.pulls.list({...repo,head:`${repo.owner}:${branch}`,state:'all',per_page:100});
  const existing=prs.find(pr=>pr.head.ref===branch);
  if(existing) {
    if(existing.head.sha!==commitSha||existing.base.ref!==config.baseBranch||existing.state!=='open')throw new Error('Existing PR differs from this verified patch or is already closed.');
    return {branch,commit_sha:commitSha,pr_number:existing.number,pr_url:existing.html_url};
  }
  await assertBase();active(control);
  try {
    const {data:pr}=await client.rest.pulls.create({...repo,head:branch,base:config.baseBranch,title:'Fix sugar stock after a sale',body:buildPrBody(config.baseSha,verification),draft:true});
    return {branch,commit_sha:commitSha,pr_number:pr.number,pr_url:pr.html_url};
  } catch(error) {
    // A lost create response can be resumed by reading the same head instead of creating another PR.
    const {data:after}=await client.rest.pulls.list({...repo,head:`${repo.owner}:${branch}`,state:'open',per_page:100});
    const pr=after.find(p=>p.head.ref===branch&&p.head.sha===commitSha&&p.base.ref===config.baseBranch);
    if(pr)return {branch,commit_sha:commitSha,pr_number:pr.number,pr_url:pr.html_url};
    throw error;
  }
}
