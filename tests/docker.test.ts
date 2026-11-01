import { describe, expect, it } from 'vitest';
import { validatePatch, validateLockfile, restrictedDockerArgs, assertInventoryRepairScope } from '../src/server/docker';
const patch = (path: string, extra = '') => `diff --git a/${path} b/${path}\nindex 1111111..2222222 100644\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-export const x = 1;\n+export const x = 2;\n${extra}`;
describe('patch trust boundary', () => {
  it('accepts a minimal production diff and returns its exact paths', () => expect(validatePatch(patch('src/inventory.ts'))).toEqual(['src/inventory.ts']));
  it('rejects unrelated production files even if their tests could pass',()=>expect(()=>validatePatch(patch('src/App.tsx'))).toThrow());
  it.each(['package.json', '.env.local', 'src/inventory.regression.test.ts', 'src/test-setup.ts', 'src/../package.json', 'src/.hidden.ts'])('rejects forbidden path %s', path => expect(() => validatePatch(patch(path))).toThrow());
  it('rejects rename, symlink, and binary operations', () => {
    expect(() => validatePatch(patch('src/inventory.ts', 'new file mode 120000\n'))).toThrow();
    expect(() => validatePatch(patch('src/inventory.ts', 'rename to src/other.ts\n'))).toThrow();
    expect(() => validatePatch(patch('src/inventory.ts', 'GIT binary patch\n'))).toThrow();
  });
  it('rejects patches larger than 1 MB before applying', () => expect(() => validatePatch('x'.repeat(1_048_577))).toThrow());
  it('requires locked package downloads from the npm registry', () => {
    expect(() => validateLockfile({packages: {'node_modules/a': {resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz'}}})).not.toThrow();
    expect(() => validateLockfile({packages: {'node_modules/a': {resolved: 'https://evil.example/a.tgz'}}})).toThrow();
  });
  it('gives verification no network, no secrets, no privileges, and a read-only root', () => {
    const args = restrictedDockerArgs('/tmp/job/candidate', 'node@sha256:abc', ['npm', 'test']);
    expect(args).toEqual(expect.arrayContaining(['--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--user=1000:1000']));
    expect(args.join(' ')).not.toMatch(/GEMINI|GITHUB|\.env|--env=HOME|\/Users\/[^ ]+\/:/);
  });
});

describe('fixed demo repair scope',()=>{
 const before='// inventory module\nexport function recordMovement() {\n  if (type === "in") {\n    stockAfter = product.stock + baseQuantity;\n  } else {\n    stockAfter = product.stock + baseQuantity;\n  }\n  if (!Number.isSafeInteger(stockAfter)) throw new Error("overflow");\n}\n';
 const after=before.replace('  } else {\n    stockAfter = product.stock + baseQuantity;','  } else {\n    stockAfter = product.stock - baseQuantity;');
 it('permits the submitted arithmetic change inside the existing sale branch',()=>expect(()=>assertInventoryRepairScope(before,after)).not.toThrow());
 it('rejects unrelated edits in the same module',()=>expect(()=>assertInventoryRepairScope(before,after.replace('// inventory module','// unrelated feature'))).toThrow());
 it('rejects added side effects inside the sale branch',()=>expect(()=>assertInventoryRepairScope(before,after.replace('stockAfter = product.stock - baseQuantity;','stockAfter = product.stock - baseQuantity;\n    fetch("https://example.com");'))).toThrow());
});

import { assertCompleteCandidateTests } from '../src/server/docker';
describe('immutable verification oracle',()=>{
  it('mounts source and every trusted test/config input read-only',()=>{
    const args=restrictedDockerArgs('/tmp/candidate','node@sha256:abc',['npm','test'],{inputs:['src','scripts','package.json','package-lock.json','vite.config.ts','tsconfig.json'],distDir:'/tmp/artifacts/dist',resultsDir:'/tmp/artifacts/results'});
    const mounts=args.filter(arg=>arg.startsWith('type=bind,'));
    for(const mount of mounts){if(!mount.includes('target=/workspace/dist')&&!mount.includes('target=/results'))expect(mount).toContain(',readonly');}
    expect(mounts).toEqual(expect.arrayContaining([expect.stringContaining('target=/workspace/src,readonly'),expect.stringContaining('target=/workspace/package.json,readonly')]));
    expect(mounts).not.toEqual(expect.arrayContaining([expect.stringMatching(/target=\/workspace(?:,|$)/)]));
    expect(args).toContain('--tmpfs=/workspace:rw,nosuid,size=512m,uid=1000,gid=1000');
  });
  const baseline={numTotalTests:2,numPassedTests:1,numFailedTests:1,numPendingTests:0,testResults:[{name:'/baseline/src/inventory.test.ts',assertionResults:[{fullName:'seed inventory',title:'seed inventory',status:'passed'},{fullName:'selling 2 kg sugar from 15 kg leaves 13 kg',title:'selling 2 kg sugar from 15 kg leaves 13 kg',status:'failed'}]}]};
  const candidate={...baseline,numPassedTests:2,numFailedTests:0,success:true,testResults:[{name:'/candidate/src/inventory.test.ts',assertionResults:baseline.testResults[0].assertionResults.map(test=>({...test,status:'passed'}))}]};
  it('requires all original assertions to complete and pass',()=>expect(()=>assertCompleteCandidateTests(baseline,candidate,'/baseline','/candidate')).not.toThrow());
  it('rejects a skipped or silently omitted original assertion',()=>{
    expect(()=>assertCompleteCandidateTests(baseline,{...candidate,numPendingTests:1},'/baseline','/candidate')).toThrow();
    expect(()=>assertCompleteCandidateTests(baseline,{...candidate,testResults:[{...candidate.testResults[0],assertionResults:[]} ]},'/baseline','/candidate')).toThrow();
  });
  it('rejects replaced test names even when summary claims everything passed',()=>{
    const replaced={...candidate,testResults:[{...candidate.testResults[0],assertionResults:candidate.testResults[0].assertionResults.map((test,index)=>({...test,fullName:index?'made-up check':test.fullName}))}]};
    expect(()=>assertCompleteCandidateTests(baseline,replaced,'/baseline','/candidate')).toThrow();
  });
});

import { createHash } from 'node:crypto';
import { lockedPackages, verifyPackageIntegrity } from '../src/server/docker';
describe('locked anonymous dependency cache',()=>{
  it('keeps Linux arm64 prebuilt packages and excludes incompatible optional binaries',()=>{
    const lock={packages:{'node_modules/@esbuild/linux-arm64':{resolved:'https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.25.0.tgz',integrity:'sha512-x',optional:true,os:['linux'],cpu:['arm64']},'node_modules/@esbuild/darwin-arm64':{resolved:'https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.25.0.tgz',integrity:'sha512-y',optional:true,os:['darwin'],cpu:['arm64']}}};
    expect(lockedPackages(lock,'linux','arm64').map(item=>item.packagePath)).toEqual(['node_modules/@esbuild/linux-arm64']);
  });
  it('rejects downloaded bytes that do not match the immutable lock SRI',()=>{
    const bytes=Buffer.from('locked tarball');const integrity='sha512-'+createHash('sha512').update(bytes).digest('base64');
    expect(verifyPackageIntegrity(bytes,integrity).sha512).toBe(integrity);
    expect(()=>verifyPackageIntegrity(Buffer.from('different package'),integrity)).toThrow(/integrity/i);
  });
  it('verifies existing legacy lock SRI and also computes SHA512 for the task cache',()=>{
    const bytes=Buffer.from('legacy locked tarball');const integrity='sha1-'+createHash('sha1').update(bytes).digest('base64');
    const proof=verifyPackageIntegrity(bytes,integrity);expect(proof.algorithm).toBe('sha1');expect(proof.sha512).toMatch(/^sha512-/);
  });
});

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writePackageCacheContent } from '../src/server/docker';
it('reuses a read-only cached artifact and rejects replacing its bytes',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'kirana-cache-'));
  try {
    const bytes=Buffer.from('exact locked dependency'),hex=createHash('sha512').update(bytes).digest('hex');
    await writePackageCacheContent(dir,'sha512',hex,bytes);
    await expect(writePackageCacheContent(dir,'sha512',hex,bytes)).resolves.toBeUndefined();
    await expect(writePackageCacheContent(dir,'sha512',hex,Buffer.from('different artifact'))).rejects.toThrow(/cache/i);
  }finally{await rm(dir,{recursive:true,force:true});}
});
