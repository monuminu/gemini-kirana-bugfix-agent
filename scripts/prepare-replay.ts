import {execFileSync} from 'node:child_process';
import path from 'node:path';
// Synthetic test media only. ffmpeg is a local prerequisite for this optional replay.
const dir=path.resolve('work/voice-fixtures');
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(dir,'report.wav'),'-f','lavfi','-t','40','-i','anullsrc=r=48000:cl=mono','-i',path.join(dir,'approval.wav'),'-f','lavfi','-t','600','-i','anullsrc=r=48000:cl=mono','-filter_complex','[0:a]aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=mono[a0];[2:a]aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=mono[a2];[a0][1:a][a2][3:a]concat=n=4:v=0:a=1[out]','-map','[out]','-ac','1','-ar','48000','-c:a','pcm_s16le',path.join(dir,'shopkeeper-replay.wav')],{stdio:['ignore','pipe','pipe'],timeout:30000});
console.log('Prepared synthetic Hindi report, 40-second read-back gap, approval and quiet microphone tail.');
