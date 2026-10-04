import { Mp3Encoder } from "@breezystack/lamejs";

export function encodeMp3(channels: Float32Array[], sampleRate: number, progress: (percent: number) => void = () => {}): ArrayBuffer {
  if (![1, 2].includes(channels.length) || !channels[0]?.length || channels.some(c => c.length !== channels[0].length)) {
    throw new Error("Please use a mono or stereo WAV file.");
  }
  if (![32000, 44100, 48000].includes(sampleRate)) throw new Error("Unsupported audio sample rate.");
  const encoder = new Mp3Encoder(channels.length, sampleRate, 320);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const append = (bytes: Uint8Array) => { if (bytes.length) { const copy = new Uint8Array(bytes); chunks.push(copy); total += copy.length; } };
  for (let offset = 0; offset < channels[0].length; offset += 1152) {
    const end = Math.min(offset + 1152, channels[0].length);
    const pcm = channels.map(channel => {
      const block = new Int16Array(end - offset);
      for (let i = offset; i < end; i++) {
        const sample = Math.max(-1, Math.min(1, channel[i]));
        block[i - offset] = Math.round(sample * (sample < 0 ? 32768 : 32767));
      }
      return block;
    });
    append(encoder.encodeBuffer(pcm[0], pcm[1]));
    if (offset % (1152 * 100) === 0) progress(Math.floor(end / channels[0].length * 100));
  }
  append(encoder.flush());
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  progress(100);
  return result.buffer;
}
