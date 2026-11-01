import { describe, expect, it, vi } from 'vitest';
import { publishPatch, buildPrBody } from '../src/server/github';
const config = { repository:'owner/repo', baseBranch:'main', githubToken:'server-only-token', baseSha:'a'.repeat(40), jobId:'job-123' };
const files = [{path:'src/inventory.ts',content:'export const amount = 13000;\n'}];
const verification = { checks:[{command:'npm test',exit_code:0}], baseline_failed:true, source_sha:config.baseSha, artifact_sha:'b'.repeat(64) };
function githubMock(main = config.baseSha) {
  const commits = new Map<string, any>();
  return {rest: {git:{getRef:vi.fn(async ({ref}:any) => { if (ref === 'heads/main') return {data:{object:{sha:main}}}; throw Object.assign(new Error('missing'),{status:404}); }),getCommit:vi.fn(async(_params:any)=>({data:{tree:{sha:'base-tree'},parents:[{sha:config.baseSha}]}})),createBlob:vi.fn(async()=>({data:{sha:'blob'}})),createTree:vi.fn(async()=>({data:{sha:'candidate-tree'}})),createCommit:vi.fn(async(data:any)=>{commits.set('commit',data);return{data:{sha:'commit'}}}),createRef:vi.fn(async()=>({data:{}}))},pulls:{list:vi.fn(async()=>({data:[]})),create:vi.fn(async()=>({data:{number:1,html_url:'https://github.com/owner/repo/pull/1'}}))}}};
}
describe('backend publication', () => {
  it('rejects a stale main before any mutation', async () => {
    const client = githubMock('c'.repeat(40));
    await expect(publishPatch(config, files, verification, client as any)).rejects.toThrow(/base/i);
    expect(client.rest.git.createBlob).not.toHaveBeenCalled();
  });
  it('creates an atomic commit and new branch, then a single draft PR', async () => {
    const client = githubMock();
    const result = await publishPatch(config, files, verification, client as any);
    expect(result.branch).toBe('bugfix/kirana/job-123');
    expect(client.rest.git.createCommit).toHaveBeenCalledWith(expect.objectContaining({parents:[config.baseSha],tree:'candidate-tree'}));
    expect(client.rest.git.createRef).toHaveBeenCalledWith(expect.objectContaining({ref:'refs/heads/bugfix/kirana/job-123',sha:'commit'}));
    expect(client.rest.pulls.create).toHaveBeenCalledWith(expect.objectContaining({draft:true,head:'bugfix/kirana/job-123',base:'main'}));
  });
  it('does not publish an unverified candidate', async () => {
    const client = githubMock();
    await expect(publishPatch(config, files, {...verification,baseline_failed:false}, client as any)).rejects.toThrow(/verification/i);
    expect(client.rest.git.createBlob).not.toHaveBeenCalled();
  });
  it('keeps PR copy synthetic and excludes the transcript', () => {
    const body = buildPrBody(config.baseSha,verification);
    expect(body).toContain('15 kg'); expect(body).toContain('13 kg');
    expect(body).not.toContain('server-only-token');
  });
});

describe('publication restart',()=>{
  it('reuses a matching branch and PR without another ref or PR create',async()=>{
    const client=githubMock();
    client.rest.git.getRef.mockImplementation(async({ref}:any)=>({data:{object:{sha:ref==='heads/main'?config.baseSha:'existing-commit'}}}));
    client.rest.git.getCommit.mockImplementation(async({commit_sha}:any)=>({data:{tree:{sha:commit_sha===config.baseSha?'base-tree':'candidate-tree'},parents:[{sha:config.baseSha}]}}));
    client.rest.pulls.list.mockResolvedValue({data:[{head:{ref:'bugfix/kirana/job-123',sha:'existing-commit'},base:{ref:'main'},state:'open',number:5,html_url:'https://github.com/owner/repo/pull/5'}]} as any);
    const result=await publishPatch(config,files,verification,client as any);
    expect(result.commit_sha).toBe('existing-commit');expect(result.pr_number).toBe(5);
    expect(client.rest.git.createRef).not.toHaveBeenCalled();expect(client.rest.pulls.create).not.toHaveBeenCalled();
  });
  it('refuses to reuse an existing job branch with unexpected contents',async()=>{
    const client=githubMock();
    client.rest.git.getRef.mockImplementation(async({ref}:any)=>({data:{object:{sha:ref==='heads/main'?config.baseSha:'other-commit'}}}));
    client.rest.git.getCommit.mockImplementation(async({commit_sha}:any)=>({data:{tree:{sha:commit_sha===config.baseSha?'base-tree':'evil-tree'},parents:[{sha:config.baseSha}]}}));
    await expect(publishPatch(config,files,verification,client as any)).rejects.toThrow(/does not match/);
    expect(client.rest.pulls.create).not.toHaveBeenCalled();
  });
});
