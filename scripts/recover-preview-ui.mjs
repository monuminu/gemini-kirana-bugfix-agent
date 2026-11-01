// Recovery evidence for an already accepted, published repair. This script
// uses a trusted local test-session cookie; it never starts Live or a repair.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const {values}=parseArgs({options:{session:{type:'string'},job:{type:'string'},commit:{type:'string'},pr:{type:'string'},timeout:{type:'string',default:'900000'}}});
for(const name of ['session','job','commit','pr'])if(!values[name])throw new Error(`Missing --${name}. Supply the existing published repair identity.`);
if(!/^[a-f0-9-]{36}$/i.test(values.session) || !/^[a-f0-9-]{36}$/i.test(values.job) || !/^[a-f0-9]{40}$/i.test(values.commit))throw new Error('Invalid existing repair identity.');
if(!/^https:\/\/github\.com\/monuminu\/kirana-saathi-demo\/pull\/\d+$/.test(values.pr))throw new Error('Expected an existing kirana-saathi-demo pull request.');
const timeout=Number(values.timeout);
if(!Number.isFinite(timeout) || timeout<1000 || timeout>900000)throw new Error('Recovery timeout must be between 1 second and 15 minutes.');
const consoleUrl='http://127.0.0.1:4300';
const out=path.resolve('work/e2e-recovery');
await mkdir(out,{recursive:true});
const result={phase:'preview_recovery',started_at:new Date().toISOString(),original_replay_evidence:'../e2e-ui/result.json',evidence_scope:'Restored existing session and published repair; separate from original synthetic Hindi microphone/video replay.',session_id:values.session,job_id:values.job,expected_commit_sha:values.commit,expected_pr_url:values.pr,timeout_ms:timeout,steps:[],forbidden_requests:[],page_errors:[],passed:false};
const mark=(name,extra={})=>{result.steps.push({name,time:new Date().toISOString(),...extra});console.log(name);};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1365,height:1100},locale:'hi-IN'});
await context.addCookies([{name:'kirana_session',value:values.session,url:consoleUrl,httpOnly:true,sameSite:'Strict'}]);
await context.route('**/api/sessions/*/live-token',route=>{result.forbidden_requests.push({path:new URL(route.request().url()).pathname,kind:'live_token'});return route.abort('blockedbyclient');});
await context.route('**/api/sessions/*/tools/*',route=>{result.forbidden_requests.push({path:new URL(route.request().url()).pathname,kind:'repair_tool'});return route.abort('blockedbyclient');});
let page;
try{
  page=await context.newPage();
  page.on('pageerror',error=>result.page_errors.push(error.message));
  const bootstrapResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/sessions' && response.request().method()==='POST');
  await page.goto(consoleUrl,{waitUntil:'networkidle'});
  const bootstrap=await(await bootstrapResponse).json();
  expect(bootstrap.sessionId).toBe(values.session);
  expect(bootstrap.job?.id).toBe(values.job);
  expect(bootstrap.job?.pr_url).toBe(values.pr);
  expect(bootstrap.job?.commit_sha).toBe(values.commit);
  expect(bootstrap.report?.id).toBe(bootstrap.job?.report_id);
  await expect(page.locator('.report-title')).toBeVisible();
  await expect(page.locator('.job-card')).toBeVisible();
  await expect(page.getByRole('button',{name:'बात शुरू करें',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'माइक रोकें',exact:true})).toHaveCount(0);
  result.restored={report_id:bootstrap.report.id,report_version:bootstrap.report.version,summary_hi:bootstrap.report.summary_hi,expected_hi:bootstrap.report.expected_hi,actual_hi:bootstrap.report.actual_hi,transcript_count:bootstrap.turns.length,evidence_count:bootstrap.evidence_ids.length,job_status:bootstrap.job.status,job_stage:bootstrap.job.stage};
  await page.screenshot({path:path.join(out,'restored-console.png'),fullPage:true});
  mark('Existing session, report, conversation and published job restored without Live audio');

  const deadline=Date.now()+timeout;
  let job=bootstrap.job;
  let lastStatus=`${job.status}:${job.stage}`;
  while(Date.now()<deadline){
    const response=await context.request.get(`${consoleUrl}/api/jobs/${values.job}`);
    if(!response.ok())throw new Error(`Existing-job status HTTP ${response.status()}.`);
    job=await response.json();
    expect(job.id).toBe(values.job);
    expect(job.commit_sha).toBe(values.commit);
    expect(job.pr_url).toBe(values.pr);
    const status=`${job.status}:${job.stage}`;
    if(status!==lastStatus){mark('Existing preview recovery progressed',{status:job.status,stage:job.stage});lastStatus=status;}
    if(job.status==='completed' && job.preview_url)break;
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  if(job.status!=='completed' || !job.preview_url)throw new Error(`Preview recovery did not complete within ${timeout} ms. Last status ${job.status}/${job.stage}.`);
  const previewUrl=new URL(job.preview_url);
  if(!['127.0.0.1','localhost'].includes(previewUrl.hostname) || previewUrl.protocol!=='http:')throw new Error('Expected a local exact-commit preview.');
  result.recovered_job={status:job.status,stage:job.stage,message_hi:job.message_hi,pr_url:job.pr_url,commit_sha:job.commit_sha,preview_url:job.preview_url,attempt:job.attempt,verification:job.verification};

  // A reload also covers the case where the initial snapshot was a terminal
  // preview error and therefore had no open SSE subscription to resume.
  const resumedResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/sessions' && response.request().method()==='POST');
  await page.reload({waitUntil:'networkidle'});
  const resumed=await(await resumedResponse).json();
  expect(resumed.sessionId).toBe(values.session);
  expect(resumed.job.id).toBe(values.job);
  result.csrf_rotated_on_reload=bootstrap.csrfToken!==resumed.csrfToken;
  expect(result.csrf_rotated_on_reload).toBe(true);
  await expect(page.getByRole('link',{name:'बदला हुआ ऐप देखें'})).toHaveAttribute('href',job.preview_url);
  await expect(page.getByRole('link',{name:'कोड का बदलाव देखें'})).toHaveAttribute('href',values.pr);
  await expect(page.getByRole('button',{name:'बात शुरू करें',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(out,'completed-console.png'),fullPage:true});
  mark('Same completed repair and existing PR/preview links restored after reload');

  const previewPromise=context.waitForEvent('page');
  await page.getByRole('link',{name:'बदला हुआ ऐप देखें'}).click();
  const preview=await previewPromise;
  preview.on('pageerror',error=>result.page_errors.push(error.message));
  await preview.waitForLoadState('networkidle');
  await preview.getByRole('button',{name:'नमूना फिर से शुरू करें',exact:true}).click();
  await preview.getByRole('dialog').getByRole('button',{name:'फिर से शुरू करें',exact:true}).click();
  await expect(preview.getByRole('button',{name:'चीनी चुनें',exact:true})).toContainText('15 किलो');
  await preview.getByRole('button',{name:'चीनी चुनें',exact:true}).click();
  await preview.getByRole('button',{name:'बिक्री हुई',exact:true}).click();
  await preview.getByLabel('मात्रा',{exact:true}).fill('2');
  await preview.getByRole('button',{name:'बिक्री दर्ज करें',exact:true}).click();
  await expect(preview.getByRole('button',{name:'चीनी चुनें',exact:true})).toContainText('13 किलो');
  await preview.screenshot({path:path.join(out,'fixed-preview.png'),fullPage:true});
  await preview.reload({waitUntil:'networkidle'});
  await expect(preview.getByRole('button',{name:'चीनी चुनें',exact:true})).toContainText('13 किलो');
  await preview.screenshot({path:path.join(out,'fixed-preview-reloaded.png'),fullPage:true});
  result.stock_check={product_hi:'चीनी',initial_kg:15,sale_kg:2,remaining_kg:13,persisted_after_reload:true};
  expect(result.forbidden_requests).toEqual([]);
  expect(result.page_errors).toEqual([]);
  result.passed=true;
  mark('Existing exact-commit preview verified: 15 − 2 = 13 kg, preserved after reload');
}catch(error){
  result.error=String(error);
  if(page){result.visible_text=(await page.locator('body').innerText().catch(()=>'' )).slice(-5000);await page.screenshot({path:path.join(out,'recovery-failure.png'),fullPage:true}).catch(()=>{});}
  console.error(result.error);
  process.exitCode=1;
}finally{
  result.finished_at=new Date().toISOString();
  await writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));
  await browser.close();
}
