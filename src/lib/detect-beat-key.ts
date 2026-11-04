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
const scales = [[0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10]];
const bassLimit = 150;
type Peak = { note: number; weight: number; bass: boolean };
type SpectralPeak = Peak & { hz: number; magnitude: number };

function emptyChroma() {
  return Array<number>(12).fill(0);
}

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

function rankKeys(chroma: number[], bass: number[]) {
  const mean = chroma.reduce((sum, value) => sum + value, 0) / 12;
  const centered = chroma.map(value => value - mean);
  return profiles.flatMap((profile, mode) => {
    const profileMean = profile.reduce((sum, value) => sum + value, 0) / 12;
    const norm = Math.hypot(...centered) * Math.hypot(...profile.map(value => value - profileMean));
    return names.map((_, root) => {
      const correlation = norm ? centered.reduce((sum, value, i) => sum + value * (profile[(i - root + 12) % 12] - profileMean), 0) / norm : 0;
      const inScale = scales[mode].reduce((sum, step) => sum + chroma[(root + step) % 12], 0);
      // The bass can distinguish relative keys whose melodies share the same notes.
      const tonicBass = bass[root] + 0.25 * bass[(root + 7) % 12];
      return { root, mode, score: correlation + 0.35 * inScale + 0.35 * tonicBass, correlation, inScale };
    });
  }).sort((a, b) => b.score - a.score);
}

export function detectBeatKey(channels: Float32Array[], sampleRate: number, detuneCents = 0): string {
  // Sample windows across the whole beat. Decimation gives finer bass pitch resolution.
  const stride = 4;
  const binHz = sampleRate / stride / size;
  const length = channels[0]?.length ?? 0;
  const span = size * stride;
  if (length < span * 3) return "";
  const frames = Math.min(216, Math.floor(length / span * 2));
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  const firstBin = Math.ceil(32 / binHz);
  const lastBin = Math.min(size / 2 - 13, Math.floor(2400 / binHz));
  const magnitudes = new Float64Array(lastBin + 13);
  const peaksByFrame: Peak[][] = [];
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
    for (let i = Math.max(0, firstBin - 12); i < magnitudes.length; i++) magnitudes[i] = Math.hypot(real[i], imaginary[i]);

    const peaks: SpectralPeak[] = [];
    for (let i = firstBin; i <= lastBin; i++) {
      const magnitude = magnitudes[i];
      if (magnitude < 0.04 || magnitude <= magnitudes[i - 1] || magnitude <= magnitudes[i + 1]) continue;
      if (magnitude < 2.5 * Math.max(magnitudes[i - 3], magnitudes[i + 3])) continue;
      // A peak must also stand above the surrounding spectrum. This reduces
      // broadband drum and noise energy without comparing a quiet melody to the kick.
      let floor = 0;
      for (let distance = 4; distance <= 12; distance++) {
        floor += (magnitudes[i - distance] ?? 0) + magnitudes[i + distance];
      }
      floor /= 18;
      if (magnitude < 5 * floor) continue;
      const left = Math.log(Math.max(1e-12, magnitudes[i - 1]));
      const right = Math.log(Math.max(1e-12, magnitudes[i + 1]));
      const offset = 0.5 * (left - right) / (left + right - 2 * Math.log(magnitude));
      const hz = (i + offset) * binHz;
      const note = 69 + 12 * Math.log2(hz / 440) - detuneCents / 100;
      peaks.push({ note, hz, magnitude, bass: hz < bassLimit, weight: Math.sqrt(magnitude) / Math.pow(Math.max(floor, 0.04), 0.2) });
    }

    // A bass sound's upper harmonics can look like unrelated melody notes.
    // Downweight non-octave overtones backed by a stronger fundamental.
    for (const peak of peaks) {
      if (peaks.some(fundamental => {
        if (fundamental.hz * 2.9 > peak.hz || fundamental.magnitude < 2.5 * peak.magnitude) return false;
        const harmonic = Math.round(peak.hz / fundamental.hz);
        return [3, 5, 6, 7].includes(harmonic) && Math.abs(peak.hz - fundamental.hz * harmonic) < Math.max(binHz, peak.hz * 0.009);
      })) peak.weight *= 0.3;
    }

    peaks.sort((a, b) => b.weight - a.weight);
    const selected = [false, true].flatMap(bass => {
      const band = peaks.filter(peak => peak.bass === bass);
      const strongest = band[0]?.weight ?? 0;
      return band.slice(0, bass ? 3 : 10)
        .filter(peak => peak.weight >= strongest * 0.22)
        .map(({ note, weight, bass }) => ({ note, bass, weight: weight / strongest }));
    });
    for (const { note, weight, bass } of selected) {
      const evidence = weight * (bass ? 0.5 : 1);
      tuningX += evidence * Math.cos(2 * Math.PI * note);
      tuningY += evidence * Math.sin(2 * Math.PI * note);
      tuningWeight += evidence;
    }
    peaksByFrame.push(selected);
  }

  const tuning = Math.hypot(tuningX, tuningY) > tuningWeight * 0.35 ? Math.atan2(tuningY, tuningX) / (2 * Math.PI) : 0;
  // A mix tuned halfway between two notes has no clear concert-pitch label.
  if (Math.abs(tuning) > 0.42) return "";
  const sections = Array.from({ length: 6 }, () => ({ melody: emptyChroma(), bass: emptyChroma(), melodyFrames: 0, bassFrames: 0 }));
  peaksByFrame.forEach((peaks, index) => {
    const melody = emptyChroma();
    const bass = emptyChroma();
    for (const peak of peaks) {
      const { note, weight } = peak;
      const pitch = Math.round(note - tuning);
      if (Math.abs(note - tuning - pitch) > 0.28) continue;
      const pitchClass = (pitch % 12 + 12) % 12;
      const chroma = peak.bass ? bass : melody;
      chroma[pitchClass] = Math.max(chroma[pitchClass], weight);
    }
    const section = sections[Math.floor(index * sections.length / frames)];
    const melodyTotal = melody.reduce((sum, value) => sum + value, 0);
    const bassTotal = bass.reduce((sum, value) => sum + value, 0);
    if (melodyTotal) {
      melody.forEach((value, i) => { section.melody[i] += value / melodyTotal; });
      section.melodyFrames++;
    }
    if (bassTotal) {
      bass.forEach((value, i) => { section.bass[i] += value / bassTotal; });
      section.bassFrames++;
    }
  });

  const active = sections.filter(section => section.melodyFrames >= 2);
  const melodyFrames = active.reduce((sum, section) => sum + section.melodyFrames, 0);
  if (active.length < 2 || melodyFrames < frames * 0.18) return "";
  const bassFrames = active.reduce((sum, section) => sum + section.bassFrames, 0);
  const melody = names.map((_, i) => active.reduce((sum, section) => sum + section.melody[i], 0) / melodyFrames);
  const bass = names.map((_, i) => active.reduce((sum, section) => sum + section.bass[i], 0) / Math.max(melodyFrames, bassFrames));
  const chroma = melody.map((value, i) => value + 0.3 * bass[i]);
  if (chroma.filter(value => value >= 0.05).length < 3) return "";
  const [best, next] = rankKeys(chroma, bass);
  const third = melody[(best.root + (best.mode ? 3 : 4)) % 12];
  if (best.correlation < 0.59 || best.score - next.score < 0.055 || third < 0.035) return "";

  // A confident disagreement between sections can indicate a key change.
  const conflicting = active.filter(section => {
    const localBass = section.bass.map(value => value / Math.max(section.melodyFrames, section.bassFrames));
    const localChroma = section.melody.map((value, i) => value / section.melodyFrames + 0.3 * localBass[i]);
    const [top, runnerUp] = rankKeys(localChroma, localBass);
    return top.root !== best.root && top.correlation > 0.65 && top.score - runnerUp.score > 0.12;
  }).length;
  return conflicting < active.length / 2 ? `${names[best.root]} ${best.mode ? "minor" : "major"}` : "";
}
