import { checkPreview } from '../src/server/docker.js';
export { checkPreview };
if(process.argv[1]?.endsWith('preview-check.ts')) {
  const url=process.argv[2];if(!url)throw new Error('Usage: tsx scripts/preview-check.ts http://127.0.0.1:4310/');
  await checkPreview(url,process.argv[3]);
}
