// OpenKeyScan's input is log-magnitude CQT, from 65 Hz at 24 bins per octave.
export const keyBins = 105;
const featureRate = 11_025;
const hop = featureRate / 5;
const octaveBandwidth = Math.tanh(Math.LN2 / 24);
const maxSegmentSeconds = 40;
const minSeconds = 3;

// Low-pass before downsampling from the upload decoder's 44.1 kHz.
const filter = Array.from({ length: 49 }, (_, i) => {
  const x = i - 24;
  const cutoff = 0.11;
  return (x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x))
    * (0.5 + 0.5 * Math.cos(Math.PI * x / 24));
});
const filterGain = filter.reduce((sum, tap) => sum + tap, 0);

function monoSegment(channels: Float32Array[], start: number, length: number) {
  const output = new Float32Array(Math.ceil(length / 4));
  const left = channels[0];
  const right = channels[1];
  // Keep an audible channel when summing stereo would cancel most of the mix.
  let stereoEnergy = 0;
  let monoEnergy = 0;
  if (right) {
    for (let i = start; i < start + length; i += 127) {
      stereoEnergy += (left[i] ** 2 + right[i] ** 2) / 2;
      monoEnergy += ((left[i] + right[i]) / 2) ** 2;
    }
  }
  const mixStereo = right && monoEnergy > 0.1 * stereoEnergy;
  for (let i = 0; i < output.length; i++) {
    const center = start + i * 4;
    let value = 0;
    for (let tap = 0; tap < filter.length; tap++) {
      const j = center + tap - 24;
      if (j < start || j >= start + length) continue;
      value += filter[tap] * (mixStereo ? (left[j] + right[j]) / 2 : left[j]);
    }
    output[i] = value / filterGain;
  }
  return output;
}

function makeKernel(bin: number, detuneCents: number) {
  const frequency = 65 * 2 ** (bin / 24 + detuneCents / 1200);
  const width = featureRate / (octaveBandwidth * frequency);
  const start = Math.floor(-width / 2);
  const length = Math.floor(width / 2) - start;
  const real = new Float32Array(length);
  const imaginary = new Float32Array(length);
  const gain = 2 * Math.sqrt(width) / length;
  for (let i = 0; i < length; i++) {
    const window = gain * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / length));
    const phase = 2 * Math.PI * frequency * (i + start) / featureRate;
    real[i] = window * Math.cos(phase);
    imaginary[i] = window * Math.sin(phase);
  }
  return { start, real, imaginary };
}

export function openKeyFeatures(channels: Float32Array[], sampleRate: number, detuneCents = 0) {
  const total = channels[0]?.length ?? 0;
  if (sampleRate !== 44_100 || total < minSeconds * sampleRate) return null;

  // Analyze the whole beat up to two minutes. For longer files take evenly
  // spaced excerpts so inference memory stays bounded on phones.
  const segmentCount = total > 3 * maxSegmentSeconds * sampleRate ? 3 : 1;
  const segmentLength = segmentCount === 1 ? total : maxSegmentSeconds * sampleRate;
  const audio = Array.from({ length: segmentCount }, (_, i) => {
    const start = segmentCount === 1 ? 0 : Math.round(i * (total - segmentLength) / (segmentCount - 1));
    return monoSegment(channels, start, segmentLength);
  });
  const frameCounts = audio.map(segment => Math.floor(segment.length / hop) - 1);
  const frames = frameCounts.reduce((sum, count) => sum + count, 0);
  const data = new Float32Array(keyBins * frames);
  let peak = 0;
  for (const segment of audio) {
    for (const value of segment) peak = Math.max(peak, Math.abs(value));
  }
  if (peak < 0.001) return null;

  // Center the filterbank on the declared tuning. The output class then
  // describes the original key without modifying the audio or downloads.
  const tuning = Number.isFinite(detuneCents) ? detuneCents % 1200 : 0;
  for (let bin = 0; bin < keyBins; bin++) {
    const { start, real, imaginary } = makeKernel(bin, tuning);
    let offset = bin * frames;
    for (let segment = 0; segment < audio.length; segment++) {
      const samples = audio[segment];
      for (let frame = 0; frame < frameCounts[segment]; frame++) {
        const first = frame * hop + start;
        let re = 0;
        let im = 0;
        for (let i = Math.max(0, -first), end = Math.min(real.length, samples.length - first); i < end; i++) {
          const value = samples[first + i];
          re += value * real[i];
          im += value * imaginary[i];
        }
        data[offset++] = Math.log1p(Math.hypot(re, im));
      }
    }
  }
  return { data, frames };
}
