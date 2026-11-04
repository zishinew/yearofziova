import { detuningFromText } from "./track-upload";

async function processWav(file: File, onProgress: (message: string) => void, encode: boolean, analyze: boolean, detuneCents?: number) {
  if (!/\.wav$/i.test(file.name) || !file.size) throw new Error("Choose a non-empty WAV file.");
  onProgress("Reading WAV…");
  const input = await file.arrayBuffer();
  const header = new DataView(input);
  if (input.byteLength < 12 || header.getUint32(0) !== 0x52494646 || header.getUint32(8) !== 0x57415645) throw new Error("This file isn't a valid WAV.");
  // Decode at a standard MP3 rate, including resampling 48/96 kHz WAV sources.
  const context = new OfflineAudioContext(2, 1, 44100);
  let audio: AudioBuffer;
  try { audio = await context.decodeAudioData(input); }
  catch { throw new Error("Couldn't read this WAV. Export it as a standard PCM WAV and try again."); }
  if (![1, 2].includes(audio.numberOfChannels)) throw new Error("Please use a mono or stereo WAV file.");
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i).slice());
  const worker = new Worker(new URL("./mp3.worker.ts", import.meta.url));
  const result = await new Promise<{ mp3?: ArrayBuffer; key: string }>((resolve, reject) => {
    const timer = window.setTimeout(() => { worker.terminate(); reject(new Error("Audio processing timed out. Please try a shorter WAV.")); }, 10 * 60 * 1000);
    const finish = () => { window.clearTimeout(timer); worker.terminate(); };
    worker.onerror = () => { finish(); reject(new Error("Couldn't process the WAV. Please try again.")); };
    worker.onmessage = (event: MessageEvent<{ analyzing?: boolean; percent?: number; mp3?: ArrayBuffer; key?: string; error?: string }>) => {
      if (event.data.error) { finish(); reject(new Error(event.data.error)); }
      else if (event.data.key !== undefined) { finish(); resolve({ key: event.data.key, mp3: event.data.mp3 }); }
      else if (event.data.analyzing) onProgress("Detecting musical key…");
      else if (event.data.percent !== undefined) onProgress(`Creating MP3… ${event.data.percent}%`);
    };
    worker.postMessage({
      channels, sampleRate: audio.sampleRate, encode, analyze,
      detuneCents: detuneCents ?? detuningFromText(file.name),
    }, channels.map(channel => channel.buffer));
  });
  return { ...result, duration: Math.max(1, Math.round(audio.duration)) };
}

export async function detectWavKey(file: File, onProgress: (message: string) => void, detuneCents?: number) {
  return (await processWav(file, onProgress, false, true, detuneCents)).key;
}

export async function wavToMp3(file: File, onProgress: (message: string) => void, analyze = true, detuneCents?: number) {
  const { mp3: encoded, key, duration } = await processWav(file, onProgress, true, analyze, detuneCents);
  if (!encoded) throw new Error("Couldn't create the MP3.");
  const mp3 = new File([encoded], file.name.replace(/\.wav$/i, ".mp3"), { type: "audio/mpeg" });
  return { mp3, preview: mp3, key, duration };
}
