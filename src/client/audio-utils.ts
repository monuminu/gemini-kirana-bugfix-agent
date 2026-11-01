export function encodePcm16(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, Math.round(clipped * (clipped < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}
export function decodePcm16(bytes: Uint8Array): Float32Array {
  if (bytes.byteLength % 2 !== 0) throw new Error('PCM audio must contain complete 16-bit samples.');
  const samples = new Float32Array(bytes.length / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return samples;
}

/** Keep a global sample position so worklet chunk boundaries do not change pitch. */
export class StreamingResampler {
  private readonly ratio: number;
  private inputCount = 0;
  private outputCount = 0;
  private tail?: number;
  constructor(inputRate: number, outputRate: number) {
    if (inputRate <= 0 || outputRate <= 0) throw new Error('Audio sample rates must be positive.');
    this.ratio = inputRate / outputRate;
  }
  push(input: Float32Array): Float32Array {
    if (input.length === 0) return new Float32Array();
    const offset = this.tail === undefined ? this.inputCount : this.inputCount - 1;
    const source = this.tail === undefined ? input : new Float32Array([this.tail, ...input]);
    this.inputCount += input.length;
    const output: number[] = [];
    while (this.outputCount * this.ratio <= this.inputCount - 1) {
      const position = this.outputCount * this.ratio - offset;
      const left = Math.floor(position);
      const fraction = position - left;
      const right = Math.min(left + 1, source.length - 1);
      output.push(source[left] + (source[right] - source[left]) * fraction);
      this.outputCount++;
    }
    this.tail = input[input.length - 1];
    return new Float32Array(output);
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset,offset + 8192));
  return btoa(binary);
}
export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
