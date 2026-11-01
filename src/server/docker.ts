import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import type { Verification } from '../shared/types.js';

export const MAX_PATCH_BYTES = 1_048_576;
const NODE_IMAGE = 'node:22-bookworm-slim';
const REGRESSION_TITLE = 'selling 2 kg sugar from 15 kg leaves 13 kg';
export type Control = { signal?: AbortSignal; cancelled?: () => boolean };
export type CommandResult = { command:string; exit_code:number; stdout:string; stderr:string };
export type ChangedFile = { path:string; content:string };
export type VerifiedCandidate = { verification:Verification; files:ChangedFile[]; candidateDir:string; baselineDir:string; image:string; logsDir:string; distDir:string };

export function validatePatch(patch:string):string[] {
  if (!patch || Buffer.byteLength(patch) > MAX_PATCH_BYTES || patch.includes('\0')) throw new Error('Patch is empty or exceeds the 1 MB limit.');
  if (/^(?:GIT binary patch|Binary files |(?:new|old|deleted) file mode 120000|(?:new|old) mode |(?:rename|copy) (?:from|to) |similarity index )/m.test(patch)) throw new Error('Patch must contain ordinary text edits; modes, binary files, renames and symlinks are forbidden.');
  const headers=[...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)];
  if (!headers.length) throw new Error('A git-format patch is required.');
  const files:string[]=[];
  for (const [,before,after] of headers) {
    if (before!==after || after!=='src/inventory.ts') throw new Error(`Forbidden patch path: ${after}`);
    if (files.includes(after)) throw new Error('Duplicate patch path.');
    files.push(after);
  }
  // Every unified-diff path must match a declared, allowed file.
  for (const [,prefix,p] of patch.matchAll(/^(---|\+\+\+) (.+)$/gm)) {
    if (p==='/dev/null' || !files.includes(p.replace(/^[ab]\//,''))) throw new Error(`Forbidden ${prefix} patch path.`);
  }
  return files;
}

/** This release approves only the inventory sale arithmetic, without prescribing its fix. */
export function assertInventoryRepairScope(before:string,after:string):void {
  const region=/^([\s\S]*?\nexport function recordMovement\([\s\S]*?\n  } else {\n)([\s\S]*?)(\n  }\n  if \(!Number\.isSafeInteger\(stockAfter\)\)[\s\S]*)$/;
  const original=region.exec(before);
  if(!original||!after.startsWith(original[1])||!after.endsWith(original[3]))throw new Error('Repair changes unrelated inventory code outside the approved sale branch.');
  const arithmetic=after.slice(original[1].length,after.length-original[3].length);
  if(!/^\s*stockAfter\s*=\s*(?:product\.stock|baseQuantity|[+\-*/()\s0-9.])+;\s*$/.test(arithmetic))throw new Error('Repair may change only the sale stock arithmetic assignment.');
}

export function validateLockfile(lock:unknown):void {
  if (!lock || typeof lock!=='object' || !('packages' in lock)) throw new Error('A baseline npm lockfile is required.');
  const packages=(lock as {packages:Record<string,{resolved?:string;link?:boolean}>}).packages;
  for (const [name,entry] of Object.entries(packages)) {
    if (entry.link) throw new Error(`Linked dependency is forbidden: ${name}`);
    if (entry.resolved && !entry.resolved.startsWith('https://registry.npmjs.org/')) throw new Error(`Dependency is outside the trusted npm registry: ${name}`);
  }
}

export type LockedPackage={packagePath:string;resolved:string;integrity:string};
export function lockedPackages(lock:unknown,platform:string,architecture:string):LockedPackage[] {
  validateLockfile(lock);
  const packages=(lock as {packages:Record<string,{resolved?:string;integrity?:string;optional?:boolean;os?:string[];cpu?:string[];libc?:string[]}>}).packages;
  const allowed=(values:string[]|undefined,value:string)=>!values||(!values.includes('!'+value)&&(!values.some(v=>!v.startsWith('!'))||values.includes(value)));
  const result:LockedPackage[]=[];
  for(const [packagePath,entry] of Object.entries(packages)) {
    if(!entry.resolved)continue;
    if(entry.optional&&(!allowed(entry.os,platform)||!allowed(entry.cpu,architecture)||!allowed(entry.libc,'glibc')))continue;
    if(!entry.integrity)throw new Error(`Missing immutable package integrity: ${packagePath}`);
    result.push({packagePath,resolved:entry.resolved,integrity:entry.integrity});
  }
  return result;
}
export function verifyPackageIntegrity(bytes:Buffer,integrity:string):{algorithm:string;hex:string;sha512:string} {
  const algorithms=['sha512','sha384','sha256','sha1'];
  const entries=integrity.split(/\s+/).map(value=>/^(sha512|sha384|sha256|sha1)-([A-Za-z0-9+/]+={0,2})$/.exec(value)).filter((entry):entry is RegExpExecArray=>Boolean(entry));
  const strongest=algorithms.find(algorithm=>entries.some(entry=>entry[1]===algorithm));
  if(!strongest)throw new Error('Unsupported locked package integrity.');
  const actual=createHash(strongest).update(bytes).digest();
  const valid=entries.filter(entry=>entry[1]===strongest).some(entry=>{const expected=Buffer.from(entry[2],'base64');return expected.length===actual.length&&timingSafeEqual(expected,actual);});
  if(!valid)throw new Error('Downloaded package failed immutable lock integrity verification.');
  return {algorithm:strongest,hex:actual.toString('hex'),sha512:'sha512-'+createHash('sha512').update(bytes).digest('base64')};
}
const PACKAGE_MIRROR='https://ms-feed-25.pkgs.visualstudio.com/1es-public/_packaging/npm-public/npm/registry/';
function npmContentPath(cacheDir:string,algorithm:string,hex:string):string {return path.join(cacheDir,'_cacache','content-v2',algorithm,hex.slice(0,2),hex.slice(2,4),hex.slice(4));}
export async function writePackageCacheContent(cacheDir:string,algorithm:string,hex:string,bytes:Buffer):Promise<void> {
  const file=npmContentPath(cacheDir,algorithm,hex);
  try {const existing=await fs.readFile(file);if(!existing.equals(bytes))throw new Error('Immutable package cache content changed.');return;}
  catch(error){if(!(error&&typeof error==='object'&&'code' in error&&error.code==='ENOENT'))throw error;}
  await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes,{mode:0o444});
}

async function cacheLockedPackages(dir:string,cacheDir:string,control:Control):Promise<void> {
  const lock=JSON.parse(await fs.readFile(path.join(dir,'package-lock.json'),'utf8'));
  const packages=lockedPackages(lock,'linux',process.arch);
  await fs.mkdir(cacheDir,{recursive:true,mode:0o700});
  const unique=[...new Map(packages.map(pkg=>[pkg.resolved,pkg])).values()];
  let cursor=0;
  const proof:Array<{packagePath:string;integrity:string;sha512:string}>=[];
  async function download(pkg:LockedPackage):Promise<void> {
    if(control.cancelled?.()||control.signal?.aborted)throw new Error('Job cancelled.');
    const url=new URL(pkg.resolved);
    if(url.protocol!=='https:'||url.hostname!=='registry.npmjs.org'||url.username||url.password||url.search||url.hash)throw new Error('Invalid locked public package URL.');
    const sri=/^(sha512|sha384|sha256|sha1)-([A-Za-z0-9+/]+={0,2})$/.exec(pkg.integrity);
    let bytes:Buffer|undefined;
    if(sri)try{bytes=await fs.readFile(npmContentPath(cacheDir,sri[1],Buffer.from(sri[2],'base64').toString('hex')));verifyPackageIntegrity(bytes,pkg.integrity);}catch{bytes=undefined;}
    if(!bytes) {
      const temporary=path.join(cacheDir,createHash('sha256').update(pkg.resolved).digest('hex')+'.tgz');
      const response=await command('curl',['--disable','--fail','--location','--proto','=https','--proto-redir','=https','--silent','--show-error','--max-time','45','--max-filesize','67108864','--output',temporary,PACKAGE_MIRROR+url.pathname.slice(1)],dir,control,50_000);
      if(response.exit_code!==0)throw new Error(`Anonymous locked dependency download failed for ${pkg.packagePath} (${response.exit_code}).`);
      bytes=await fs.readFile(temporary);await fs.rm(temporary,{force:true});
      if(!bytes.length||bytes.length>67_108_864)throw new Error('Locked dependency exceeds its download limit.');
    }
    const integrity=verifyPackageIntegrity(bytes,pkg.integrity),sha512Hex=Buffer.from(integrity.sha512.slice(7),'base64').toString('hex');
    await writePackageCacheContent(cacheDir,integrity.algorithm,integrity.hex,bytes);if(integrity.algorithm!=='sha512')await writePackageCacheContent(cacheDir,'sha512',sha512Hex,bytes);
    proof.push({packagePath:pkg.packagePath,integrity:pkg.integrity,sha512:integrity.sha512});
  }
  await Promise.all(Array.from({length:4},async()=>{while(cursor<unique.length){const pkg=unique[cursor++];await download(pkg);}}));
  await fs.writeFile(path.join(cacheDir,'manifest.json'),JSON.stringify({origin:'anonymous-microsoft-public-npm-mirror',packages:proof.sort((a,b)=>a.packagePath.localeCompare(b.packagePath))},null,2),{mode:0o600});
}

export type VerificationMounts={inputs?:string[];distDir?:string;resultsDir?:string};
const DEFAULT_INPUTS=['src','scripts','package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json','node_modules'];
export function restrictedDockerArgs(workspace:string,image:string,command:string[],mounts:VerificationMounts={}):string[] {
  const args=['run','--rm','--init','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=1000:1000','--cpus=2','--memory=2g','--pids-limit=256','--tmpfs=/tmp:rw,nosuid,noexec,size=256m','--tmpfs=/workspace:rw,nosuid,size=512m,uid=1000,gid=1000'];
  for(const entry of mounts.inputs??DEFAULT_INPUTS) {
    if(!/^[A-Za-z0-9_.-]+$/.test(entry)||entry==='.'||entry==='..'||entry==='.git'||(entry.startsWith('.env')&&entry!=='.env.example'))throw new Error('Invalid trusted input mount.');
    args.push('--mount',`type=bind,source=${path.resolve(workspace,entry)},target=/workspace/${entry},readonly`);
  }
  args.push('--tmpfs=/workspace/node_modules/.vite:rw,nosuid,size=128m,uid=1000,gid=1000','--tmpfs=/workspace/node_modules/.vite-temp:rw,nosuid,size=128m,uid=1000,gid=1000');
  if(mounts.distDir)args.push('--mount',`type=bind,source=${path.resolve(mounts.distDir)},target=/workspace/dist`);
  if(mounts.resultsDir)args.push('--mount',`type=bind,source=${path.resolve(mounts.resultsDir)},target=/results`);
  return [...args,'--workdir=/workspace','--env=npm_config_cache=/tmp/npm-cache',image,...command];
}
function setupDockerArgs(workspace:string,image:string,command:string[],cacheDir:string):string[] {
  return ['run','--rm','--init','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=1000:1000','--cpus=2','--memory=2g','--pids-limit=256','--tmpfs=/tmp:rw,nosuid,noexec,size=256m','--mount',`type=bind,source=${path.resolve(workspace)},target=/workspace`,'--mount',`type=bind,source=${path.join(cacheDir,'_cacache','content-v2')},target=/tmp/npm-cache/_cacache/content-v2,readonly`,'--workdir=/workspace','--env=npm_config_cache=/tmp/npm-cache',image,...command];
}

export async function command(program:string,args:string[],cwd:string,control:Control={},timeoutMs=240_000):Promise<CommandResult> {
  if (control.cancelled?.() || control.signal?.aborted) throw new Error('Job cancelled.');
  return await new Promise((resolve,reject)=>{
    const child=spawn(program,args,{cwd,env:{PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'},stdio:['ignore','pipe','pipe'],signal:control.signal});
    let stdout='',stderr='',bytes=0,finished=false;
    const append=(field:'stdout'|'stderr',chunk:Buffer)=>{ bytes+=chunk.length; if(bytes>8_388_608) {child.kill('SIGKILL');return;} if(field==='stdout')stdout+=chunk.toString();else stderr+=chunk.toString(); };
    child.stdout.on('data',c=>append('stdout',c));child.stderr.on('data',c=>append('stderr',c));
    const timer=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);
    child.on('error',error=>{if(!finished){finished=true;clearTimeout(timer);reject(error);}});
    child.on('close',(code,signal)=>{if(!finished){finished=true;clearTimeout(timer);resolve({command:[program,...args].join(' '),exit_code:code ?? 137,stdout,stderr:stderr+(signal?`\nStopped by ${signal}`:'')});}});
  });
}
async function checked(program:string,args:string[],cwd:string,control:Control={}):Promise<CommandResult> {
  const result=await command(program,args,cwd,control);
  if(result.exit_code!==0) throw new Error(`${program} failed (${result.exit_code}): ${result.stderr.slice(-1500)}`);
  return result;
}
async function makeWritable(dir:string):Promise<void> {
  await fs.chmod(dir,0o777);
  for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
    if(entry.name==='.git') continue;
    const target=path.join(dir,entry.name);
    if(entry.isSymbolicLink()) throw new Error('Repository symlinks are not permitted in verification.');
    if(entry.isDirectory()) await makeWritable(target); else await fs.chmod(target,0o666);
  }
}
export async function cloneAt(repository:string,sha:string,dir:string,control:Control={}):Promise<void> {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)|| !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid repository or immutable commit SHA.');
  await fs.rm(dir,{recursive:true,force:true});await fs.mkdir(path.dirname(dir),{recursive:true});
  await checked('git',['-c','core.hooksPath=/dev/null','clone','--no-checkout',`https://github.com/${repository}.git`,dir],path.dirname(dir),control);
  await checked('git',['-c','core.hooksPath=/dev/null','checkout','--detach',sha],dir,control);
  const actual=(await checked('git',['rev-parse','HEAD'],dir,control)).stdout.trim();
  if(actual!==sha) throw new Error('Git checkout does not match the recorded commit.');
}
async function dockerImage(dir:string,control:Control):Promise<string> {
  // Public dependency pulls must not read or wait on the user's registry credential helper.
  const cliConfig=path.join(dir,'docker-cli');await fs.mkdir(cliConfig,{recursive:true,mode:0o700});
  await fs.writeFile(path.join(cliConfig,'config.json'),JSON.stringify({auths:{}}),{mode:0o600});
  const context=(await checked('docker',['context','show'],dir,control)).stdout.trim();
  if(!/^[A-Za-z0-9_.-]+$/.test(context))throw new Error('Invalid local Docker context.');
  const socket=(await checked('docker',['context','inspect',context,'--format={{.Endpoints.docker.Host}}'],dir,control)).stdout.trim();
  if(!socket.startsWith('unix:///')||socket.includes('\n'))throw new Error('Verification requires the existing local Docker socket.');
  await fs.writeFile(path.join(cliConfig,'socket'),socket,{mode:0o600});
  await checked('docker',['--config',cliConfig,'--host',socket,'pull',NODE_IMAGE],dir,control);
  const inspect=await checked('docker',['--config',cliConfig,'--host',socket,'image','inspect',NODE_IMAGE,'--format={{index .RepoDigests 0}}'],dir,control);
  const image=inspect.stdout.trim(); if(!/^node@sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Could not pin the verification image digest.');
  return image;
}

async function dockerPrefix(jobDir:string):Promise<string[]> {
  const cliConfig=path.join(jobDir,'docker-cli'),socket=(await fs.readFile(path.join(cliConfig,'socket'),'utf8')).trim();
  if(!socket.startsWith('unix:///'))throw new Error('Missing existing local Docker socket.');
  return ['--config',cliConfig,'--host',socket];
}

async function trustedInputs(dir:string,control:Control):Promise<string[]> {
  const entries=(await checked('git',['ls-tree','--name-only','HEAD'],dir,control)).stdout.trim().split('\n').filter(Boolean);
  await fs.mkdir(path.join(dir,'node_modules','.vite'),{recursive:true});
  await fs.mkdir(path.join(dir,'node_modules','.vite-temp'),{recursive:true});
  return [...entries,'node_modules'];
}
async function outputDirectory(dir:string):Promise<void> {await fs.mkdir(dir,{recursive:true});await fs.chmod(dir,0o777);}
async function checkoutDigest(dir:string,control:Control):Promise<string> {
  const digest=createHash('sha256');
  const files=(await checked('git',['ls-files','-z'],dir,control)).stdout.split('\0').filter(Boolean).sort();
  for(const file of files){digest.update(file);digest.update('\0');digest.update(await fs.readFile(path.join(dir,file)));digest.update('\0');}
  return digest.digest('hex');
}
async function assertCheckoutDigest(dir:string,expected:string,control:Control):Promise<void> {
  if(await checkoutDigest(dir,control)!==expected)throw new Error('A verification step changed immutable source, tests, or configuration.');
}
async function dockerRun(dir:string,image:string,args:string[],log:string,control:Control,mounts:VerificationMounts={},setupCache?:string):Promise<CommandResult> {
  const name=`kirana-check-${createHash('sha256').update(log).digest('hex').slice(0,16)}`;
  const runArgs=setupCache?setupDockerArgs(dir,image,args,setupCache):restrictedDockerArgs(dir,image,args,mounts);
  runArgs.splice(1,0,'--name',name);
  let result:CommandResult;
  const jobDir=path.dirname(path.dirname(log)),prefix=await dockerPrefix(jobDir);
  try {result=await command('docker',[...prefix,...runArgs],dir,control);} finally {await command('docker',[...prefix,'rm','--force',name],dir,{},15_000).catch(()=>undefined);}
  result.command=args.join(' ');
  await fs.writeFile(log,`${result.command}\nexit_code=${result.exit_code}\n${result.stdout}\n${result.stderr}`,{mode:0o600});
  return result;
}
async function install(dir:string,image:string,log:string,control:Control,cacheDir:string):Promise<void> {
  validateLockfile(JSON.parse(await fs.readFile(path.join(dir,'package-lock.json'),'utf8')));
  await cacheLockedPackages(dir,cacheDir,control);
  await makeWritable(dir);
  const r=await dockerRun(dir,image,['npm','ci','--offline','--ignore-scripts','--no-audit','--no-fund'],log,control,{},cacheDir);
  if(r.exit_code!==0) throw new Error(`Controlled dependency installation failed (${r.exit_code}). See local verification logs.`);
}

async function hashDirectory(dir:string):Promise<string> {
  const digest=createHash('sha256');
  async function visit(current:string):Promise<void> {
    for(const entry of (await fs.readdir(current,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const target=path.join(current,entry.name);
      if(entry.isSymbolicLink()) throw new Error('Artifact symlinks are forbidden.');
      if(entry.isDirectory()) await visit(target);else {digest.update(path.relative(dir,target));digest.update('\0');digest.update(await fs.readFile(target));digest.update('\0');}
    }
  }
  await visit(dir);return digest.digest('hex');
}
type TestReport={numTotalTests?:number;numPassedTests?:number;numFailedTests?:number;numPendingTests?:number;numTodoTests?:number;success?:boolean;testResults?:Array<{name:string;assertionResults?:Array<{title?:string;fullName?:string;ancestorTitles?:string[];status?:string}>}>};
function baselineRegression(result:TestReport):boolean {
  const assertions=result.testResults?.flatMap(test=>test.assertionResults??[])??[];
  const failed=assertions.filter(test=>test.status==='failed');
  return result.numFailedTests===1&&failed.length===1&&failed[0].title===REGRESSION_TITLE&&assertions.length===result.numTotalTests&&assertions.every(test=>test.status==='passed'||test.status==='failed');
}
export function assertCompleteCandidateTests(baseline:unknown,candidate:unknown,baselineDir:string,candidateDir:string):void {
  const base=baseline as TestReport,next=candidate as TestReport;
  function assertionInventory(report:TestReport,root:string):string[] {
    return (report.testResults??[]).flatMap(file=>(file.assertionResults??[]).map(test=>`${path.relative(root,file.name)}\0${test.fullName??[...(test.ancestorTitles??[]),test.title].join(' ')}`)).sort();
  }
  const assertions=next.testResults?.flatMap(file=>file.assertionResults??[])??[];
  const before=assertionInventory(base,baselineDir),after=assertionInventory(next,candidateDir);
  if(!base.numTotalTests||next.numTotalTests!==base.numTotalTests||next.numPassedTests!==base.numTotalTests||next.numFailedTests!==0||(next.numPendingTests??0)!==0||(next.numTodoTests??0)!==0||next.success===false||assertions.length!==base.numTotalTests||assertions.some(test=>test.status!=='passed')||JSON.stringify(before)!==JSON.stringify(after))throw new Error('Candidate must complete and pass every immutable baseline assertion without skipped or replaced tests.');
}
export async function verifyPatch(repository:string,baseSha:string,patch:string,jobDir:string,control:Control={}):Promise<VerifiedCandidate> {
  const paths=validatePatch(patch);const baselineDir=path.join(jobDir,'baseline'),candidateDir=path.join(jobDir,'candidate'),logsDir=path.join(jobDir,'logs');
  const distDir=path.join(jobDir,'artifacts','candidate-dist'),baseResults=path.join(jobDir,'results','baseline'),candidateResults=path.join(jobDir,'results','candidate');
  await fs.mkdir(logsDir,{recursive:true,mode:0o700});
  await fs.rm(path.join(jobDir,'artifacts'),{recursive:true,force:true});await fs.rm(path.join(jobDir,'results'),{recursive:true,force:true});
  await Promise.all([outputDirectory(distDir),outputDirectory(baseResults),outputDirectory(candidateResults)]);
  await cloneAt(repository,baseSha,baselineDir,control);
  await fs.rm(candidateDir,{recursive:true,force:true});await fs.cp(baselineDir,candidateDir,{recursive:true});
  for(const p of paths) {const stat=await fs.lstat(path.join(candidateDir,p));if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Only existing ordinary production files may be edited.');}
  const patchFile=path.join(jobDir,'candidate.patch');await fs.writeFile(patchFile,patch,{mode:0o600});
  await checked('git',['apply','--check',patchFile],candidateDir,control);await checked('git',['apply',patchFile],candidateDir,control);
  const diffPaths=(await checked('git',['diff','--name-only'],candidateDir,control)).stdout.trim().split('\n').filter(Boolean);
  if(JSON.stringify([...diffPaths].sort())!==JSON.stringify([...paths].sort())) throw new Error('Applied patch file set differs from the declared set.');
  assertInventoryRepairScope(await fs.readFile(path.join(baselineDir,'src/inventory.ts'),'utf8'),await fs.readFile(path.join(candidateDir,'src/inventory.ts'),'utf8'));
  const baseDigest=await checkoutDigest(baselineDir,control),candidateDigest=await checkoutDigest(candidateDir,control);
  const files=await Promise.all(paths.map(async p=>({path:p,content:await fs.readFile(path.join(candidateDir,p),'utf8')})));
  const image=await dockerImage(jobDir,control);
  await install(baselineDir,image,path.join(logsDir,'baseline-install.log'),control,path.join(jobDir,'package-cache'));await assertCheckoutDigest(baselineDir,baseDigest,control);
  const baselineMounts={inputs:await trustedInputs(baselineDir,control),resultsDir:baseResults};
  const baselineTest=await dockerRun(baselineDir,image,['npm','test','--','--reporter=json','--outputFile=/results/test-results.json'],path.join(logsDir,'baseline-test.log'),control,baselineMounts);
  await assertCheckoutDigest(baselineDir,baseDigest,control);
  const baselineJson:TestReport=JSON.parse(await fs.readFile(path.join(baseResults,'test-results.json'),'utf8'));
  if(baselineTest.exit_code!==1||!baselineRegression(baselineJson))throw new Error('Baseline does not reproduce only the agreed sugar-sale regression.');
  await install(candidateDir,image,path.join(logsDir,'candidate-install.log'),control,path.join(jobDir,'package-cache'));await assertCheckoutDigest(candidateDir,candidateDigest,control);
  const candidateMounts={inputs:await trustedInputs(candidateDir,control),distDir,resultsDir:candidateResults};
  const checks:Verification['checks']=[];
  for(const script of ['test','typecheck','build']) {
    if(script==='build'){await fs.rm(distDir,{recursive:true,force:true});await outputDirectory(distDir);}
    const args=script==='test'?['npm','test','--','--reporter=json','--outputFile=/results/test-results.json']:['npm','run',script];
    const result=await dockerRun(candidateDir,image,args,path.join(logsDir,`candidate-${script}.log`),control,candidateMounts);
    checks.push({command:script==='test'?'npm test':result.command,exit_code:result.exit_code});
    await assertCheckoutDigest(candidateDir,candidateDigest,control);
    if(result.exit_code!==0)throw new Error(`Candidate ${script} failed (${result.exit_code}). See local verification logs.`);
    if(script==='test')assertCompleteCandidateTests(baselineJson,JSON.parse(await fs.readFile(path.join(candidateResults,'test-results.json'),'utf8')),baselineDir,candidateDir);
  }
  for(const file of files)if(await fs.readFile(path.join(candidateDir,file.path),'utf8')!==file.content)throw new Error('Candidate source differs from the submitted patch after verification.');
  const artifactSha=await hashDirectory(distDir);
  return {verification:{checks,baseline_failed:true,source_sha:baseSha,artifact_sha:artifactSha},files,candidateDir,baselineDir,image,logsDir,distDir};
}

export async function createPreview(repository:string,commitSha:string,jobDir:string,port:number,verified:VerifiedCandidate,control:Control={}):Promise<string> {
  const previewDir=path.join(jobDir,'published-preview');
  await cloneAt(repository,commitSha,previewDir,control);
  for(const file of ['package.json','package-lock.json','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json']) {
    if(!Buffer.from(await fs.readFile(path.join(previewDir,file))).equals(await fs.readFile(path.join(verified.baselineDir,file)))) throw new Error('Published preview changed trusted build configuration.');
  }
  const previewDigest=await checkoutDigest(previewDir,control),previewDist=path.join(jobDir,'artifacts','published-dist');
  await fs.rm(previewDist,{recursive:true,force:true});await outputDirectory(previewDist);
  await install(previewDir,verified.image,path.join(verified.logsDir,'preview-install.log'),control,path.join(jobDir,'package-cache'));await assertCheckoutDigest(previewDir,previewDigest,control);
  const build=await dockerRun(previewDir,verified.image,['npm','run','build'],path.join(verified.logsDir,'preview-build.log'),control,{inputs:await trustedInputs(previewDir,control),distDir:previewDist});
  await assertCheckoutDigest(previewDir,previewDigest,control);
  if(build.exit_code!==0)throw new Error('Published commit preview build failed.');
  const artifactSha=await hashDirectory(previewDist);
  if(artifactSha!==verified.verification.artifact_sha) throw new Error('Published commit artifacts differ from the verified candidate.');
  const name=previewContainerName(jobDir),prefix=await dockerPrefix(jobDir);
  const existing=await checked('docker',[...prefix,'ps','--all','--filter',`label=kirana.preview-port=${port}`,'--format={{.Names}}'],jobDir,control);
  for(const prior of existing.stdout.trim().split('\n').filter(Boolean)) {if(/^kirana-preview-[a-f0-9]{16}$/.test(prior))await checked('docker',[...prefix,'rm','--force',prior],jobDir,control);}
  await command('docker',[...prefix,'rm','--force',name],jobDir,{},15_000);
  // Trusted inline server serves only already-built static files. It never evaluates repository server code.
  const server="const h=require('node:http'),f=require('node:fs'),p=require('node:path');const root='/site';h.createServer((q,s)=>{let u;try{u=decodeURIComponent(new URL(q.url,'http://localhost').pathname)}catch{s.writeHead(400);return s.end()}let x=p.resolve(root,'.'+u);if(!x.startsWith(root+'/')&&x!==root){s.writeHead(403);return s.end()}if(u.endsWith('/'))x=p.join(x,'index.html');f.readFile(x,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[p.extname(x)]||'application/octet-stream');s.setHeader('Cache-Control','no-store');s.setHeader('Content-Security-Policy',\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'\");s.end(b)})}).listen(8080,'0.0.0.0')";
  await checked('docker',[...prefix,'run','-d','--name',name,'--label',`kirana.preview-port=${port}`,'--init','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=1000:1000','--cpus=1','--memory=128m','--pids-limit=32','--network=bridge','--publish',`127.0.0.1:${port}:8080`,'--mount',`type=bind,source=${previewDist},target=/site,readonly`,verified.image,'node','-e',server],jobDir,control);
  const url=`http://127.0.0.1:${port}/`;
  try {
    for(let i=0;i<30;i++) {if(control.cancelled?.())throw new Error('Job cancelled.');try{const r=await fetch(url,{signal:control.signal});if(r.ok)return url;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
    throw new Error('Static preview did not become ready.');
  } catch(error) {await command('docker',[...prefix,'rm','--force',name],jobDir,{},15_000);throw error;}
}

/** Trusted browser driver. The target serves isolated, prebuilt static assets. */
function previewContainerName(jobDir:string):string {return `kirana-preview-${createHash('sha256').update(jobDir).digest('hex').slice(0,16)}`;}
export async function stopPreview(jobDir:string):Promise<void> {await command('docker',[...await dockerPrefix(jobDir),'rm','--force',previewContainerName(jobDir)],jobDir,{},15_000);}

export async function checkPreview(url:string,artifactDir?:string,control:Control={}):Promise<void> {
  const target=new URL(url);
  if(target.hostname!=='127.0.0.1'||target.protocol!=='http:')throw new Error('Preview checks require a loopback static server.');
  if(control.cancelled?.())throw new Error('Job cancelled.');
  const bundled=chromium.executablePath();
  const bundledAvailable=await fs.access(bundled).then(()=>true,()=>false);
  const browser=await chromium.launch(bundledAvailable?{headless:true,executablePath:bundled}:{headless:true,channel:'chrome'});
  const onAbort=()=>void browser.close();control.signal?.addEventListener('abort',onAbort,{once:true});
  try {
    const context=await browser.newContext({viewport:{width:1365,height:1000},locale:'hi-IN'});
    await context.route('**/*',route=>{const requested=new URL(route.request().url());if(requested.origin===target.origin)return route.continue();return route.abort();});
    const page=await context.newPage();
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url,{waitUntil:'networkidle'});
    const reset=page.getByRole('button',{name:'नमूना फिर से शुरू करें',exact:true});
    await reset.click();
    await page.getByRole('dialog').getByRole('button',{name:'फिर से शुरू करें',exact:true}).click();
    await page.getByRole('button',{name:'चीनी चुनें',exact:true}).click();
    await page.getByRole('button',{name:'बिक्री हुई',exact:true}).click();
    await page.getByLabel('मात्रा',{exact:true}).fill('2');
    await page.getByRole('button',{name:'बिक्री दर्ज करें',exact:true}).click();
    await expect(page.getByRole('button',{name:'चीनी चुनें',exact:true})).toContainText('13 किलो');
    await page.reload({waitUntil:'networkidle'});
    await expect(page.getByRole('button',{name:'चीनी चुनें',exact:true})).toContainText('13 किलो');
    if(errors.length)throw new Error(`Preview browser errors: ${errors.join('; ')}`);
    if(artifactDir){await fs.mkdir(artifactDir,{recursive:true});await page.screenshot({path:path.join(artifactDir,'preview-13kg.png'),fullPage:true});await fs.writeFile(path.join(artifactDir,'preview-check.json'),JSON.stringify({url,expected:'13 किलो',reload_persisted:true,passed:true},null,2));}
  } finally {control.signal?.removeEventListener('abort',onAbort);await browser.close();}
}
