import { encodeMp3 } from "./mp3-encode";
import { detectBeatKey } from "./detect-beat-key";

self.onmessage = (event: MessageEvent<{ channels: Float32Array[]; sampleRate: number; encode: boolean; analyze: boolean }>) => {
  try {
    const { channels, sampleRate, encode, analyze } = event.data;
    let key = "";
    if (analyze) {
      self.postMessage({ analyzing: true });
      key = detectBeatKey(channels, sampleRate);
    }
    if (!encode) {
      self.postMessage({ key });
      return;
    }
    const mp3 = encodeMp3(channels, sampleRate, percent => self.postMessage({ percent }));
    self.postMessage({ mp3, key }, { transfer: [mp3] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Couldn't process the WAV." });
  }
};
