// Estimate major/minor keys from pitch classes, using Krumhansl–Kessler profiles.
const profiles = [
  [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
];
const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const size = 8192;
const windowWeights = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
const cosine = Float64Array.from({ length: size / 2 }, (_, i) => Math.cos(2 * Math.PI * i / size));
const sine = Float64Array.from({ length: size / 2 }, (_, i) => -Math.sin(2 * Math.PI * i / size));

function spectrum(real: Float64Array, imaginary: Float64Array) {
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let width = 2; width <= size; width *= 2) {
    const half = width / 2;
    for (let start = 0; start < size; start += width) {
      for (let i = 0; i < half; i++) {
        const a = start + i;
        const b = a + half;
        const phase = i * size / width;
        const re = real[b] * cosine[phase] - imaginary[b] * sine[phase];
        const im = real[b] * sine[phase] + imaginary[b] * cosine[phase];
        real[b] = real[a] - re;
        imaginary[b] = imaginary[a] - im;
        real[a] += re;
        imaginary[a] += im;
      }
    }
  }
}

function rankKeys(chroma: number[]) {
  const mean = chroma.reduce((sum, value) => sum + value, 0) / 12;
  const centered = chroma.map(value => value - mean);
  return profiles.flatMap((profile, mode) => {
    const profileMean = profile.reduce((sum, value) => sum + value, 0) / 12;
    const norm = Math.hypot(...centered) * Math.hypot(...profile.map(value => value - profileMean));
    return names.map((_, root) => ({
      root,
      mode,
      score: norm ? centered.reduce((sum, value, i) => sum + value * (profile[(i - root + 12) % 12] - profileMean), 0) / norm : 0,
    }));
  }).sort((a, b) => b.score - a.score);
}

export function detectBeatKey(channels: Float32Array[], sampleRate: number, detuneCents = 0): string {
  // Sample windows across the whole beat. Decimation gives finer bass pitch resolution.
  const stride = 4;
  const binHz = sampleRate / stride / size;
  const length = channels[0]?.length ?? 0;
  const span = size * stride;
  if (length < span * 3) return "";
  const frames = Math.min(144, Math.floor(length / span));
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  const firstBin = Math.ceil(40 / binHz);
  const lastBin = Math.min(size / 2 - 4, Math.floor(2400 / binHz));
  const magnitudes = new Float64Array(lastBin + 4);
  const peaksByFrame: { note: number; weight: number }[][] = [];
  let tuningX = 0;
  let tuningY = 0;
  let tuningWeight = 0;

  for (let frame = 0; frame < frames; frame++) {
    const start = Math.round(frame * (length - span) / (frames - 1));
    // Alternate stereo channels so phase cancellation cannot erase pitched notes.
    const channel = channels[frame % channels.length];
    for (let i = 0; i < size; i++) {
      const j = start + i * stride;
      real[i] = (channel[j] + channel[j + 1] + channel[j + 2] + channel[j + 3]) * windowWeights[i] / stride;
    }
    imaginary.fill(0);
    spectrum(real, imaginary);
    for (let i = firstBin - 3; i < magnitudes.length; i++) magnitudes[i] = Math.hypot(real[i], imaginary[i]);

    const peaks = [];
    for (let i = firstBin; i <= lastBin; i++) {
      const magnitude = magnitudes[i];
      if (magnitude < 0.04 || magnitude <= magnitudes[i - 1] || magnitude <= magnitudes[i + 1]) continue;
      if (magnitude < 2.5 * Math.max(magnitudes[i - 3], magnitudes[i + 3])) continue;
      const left = Math.log(Math.max(1e-12, magnitudes[i - 1]));
      const right = Math.log(Math.max(1e-12, magnitudes[i + 1]));
      const offset = 0.5 * (left - right) / (left + right - 2 * Math.log(magnitude));
      const hz = (i + offset) * binHz;
      const note = 69 + 12 * Math.log2(hz / 440) - detuneCents / 100;
      peaks.push({ note, magnitude, hz });
    }

    peaks.sort((a, b) => b.magnitude - a.magnitude);
    const strongest = peaks[0]?.magnitude ?? 0;
    peaksByFrame.push(peaks.slice(0, 16).filter(peak => peak.magnitude >= strongest * 0.08).map(peak => {
      const weight = Math.sqrt(peak.magnitude / strongest) * (peak.hz < 250 ? 1.25 : 1);
      tuningX += weight * Math.cos(2 * Math.PI * peak.note);
      tuningY += weight * Math.sin(2 * Math.PI * peak.note);
      tuningWeight += weight;
      return { note: peak.note, weight };
    }));
  }

  const tuning = Math.hypot(tuningX, tuningY) > tuningWeight * 0.35 ? Math.atan2(tuningY, tuningX) / (2 * Math.PI) : 0;
  // A mix tuned halfway between two notes has no clear concert-pitch label.
  if (Math.abs(tuning) > 0.42) return "";
  const sections = Array.from({ length: 3 }, () => ({ chroma: Array<number>(12).fill(0), count: 0 }));
  peaksByFrame.forEach((peaks, index) => {
    const chroma = Array<number>(12).fill(0);
    for (const { note, weight } of peaks) {
      const pitch = Math.round(note - tuning);
      if (Math.abs(note - tuning - pitch) > 0.25) continue;
      const pitchClass = (pitch % 12 + 12) % 12;
      chroma[pitchClass] = Math.max(chroma[pitchClass], weight);
    }
    const total = chroma.reduce((sum, value) => sum + value, 0);
    if (!total) return;
    const section = sections[Math.floor(index * 3 / frames)];
    chroma.forEach((value, i) => { section.chroma[i] += value / total; });
    section.count++;
  });

  const active = sections.filter(section => section.count >= 3);
  if (active.length < 2) return "";
  const chroma = names.map((_, i) => active.reduce((sum, section) => sum + section.chroma[i] / section.count, 0) / active.length);
  if (chroma.filter(value => value >= 0.05).length < 3) return "";
  const [best, next] = rankKeys(chroma);
  const third = chroma[(best.root + (best.mode ? 3 : 4)) % 12];
  if (best.score < 0.7 || best.score - next.score < 0.075 || third < 0.035) return "";
  const agrees = active.filter(section => {
    const [top] = rankKeys(section.chroma);
    return top.root === best.root && top.mode === best.mode;
  }).length;
  return agrees >= 2 ? `${names[best.root]} ${best.mode ? "minor" : "major"}` : "";
}
