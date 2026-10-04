import { encodeMp3 } from "./mp3-encode";
self.onmessage = (event: MessageEvent<{ channels: Float32Array[]; sampleRate: number }>) => {
  try {
    const { channels, sampleRate } = event.data;
    const mp3 = encodeMp3(channels, sampleRate, percent => self.postMessage({ percent }));
    self.postMessage({ mp3 }, { transfer: [mp3] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Couldn't create the MP3." });
  }
};
