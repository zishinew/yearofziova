import { encodeMp3 } from "./mp3-encode";
self.onmessage = (event: MessageEvent<{ channels: Float32Array[]; sampleRate: number }>) => {
  try {
    const { channels, sampleRate } = event.data;
    const mp3 = encodeMp3(channels, sampleRate, percent => self.postMessage({ percent }));
    const preview = encodeMp3(channels.map(channel => channel.subarray(0, sampleRate * 30)), sampleRate);
    self.postMessage({ mp3, preview }, { transfer: [mp3, preview] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Couldn't create the MP3." });
  }
};
