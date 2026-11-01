import { describe, expect, it } from 'vitest';
import { decodePcm16, encodePcm16, StreamingResampler } from '../src/client/audio-utils.js';

describe('PCM transport', () => {
  it('encodes clipped mono samples as signed little-endian PCM16', () => {
    expect(Array.from(encodePcm16(new Float32Array([-2, -1, 0, 0.5, 1, 2])))).toEqual([
      0, 128, 0, 128, 0, 0, 0, 64, 255, 127, 255, 127,
    ]);
  });

  it('decodes negative and positive audio values without unsigned distortion', () => {
    expect(Array.from(decodePcm16(new Uint8Array([0, 128, 0, 0, 0, 64])))).toEqual([-1, 0, 0.5]);
  });

  it('resamples the actual input sample rate to 16 kHz', () => {
    const resampler = new StreamingResampler(48000, 16000);
    expect(Array.from(resampler.push(new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8])))).toEqual([0, 3, 6]);
  });

  it('retains fractional position across microphone chunks', () => {
    const whole = new StreamingResampler(44100, 16000);
    const chunks = new StreamingResampler(44100, 16000);
    const samples = new Float32Array(Array.from({ length: 50 }, (_, i) => i / 50));
    const expected = Array.from(whole.push(samples));
    const actual = [...chunks.push(samples.slice(0, 13)), ...chunks.push(samples.slice(13, 31)), ...chunks.push(samples.slice(31))];
    expect(actual).toEqual(expected);
    expect(actual.length).toBe(18);
  });
});
