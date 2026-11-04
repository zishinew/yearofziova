import { encodeMp3 } from "./mp3-encode";

self.onmessage = async (event: MessageEvent<{ channels: Float32Array[]; sampleRate: number; encode: boolean; analyze: boolean; detuneCents?: number }>) => {
  try {
    const { channels, sampleRate, encode, analyze, detuneCents } = event.data;
    let key = "";
    if (analyze) {
      self.postMessage({ analyzing: true });
      try {
        const { detectOpenKey } = await import("./open-key-model");
        key = await detectOpenKey(channels, sampleRate, detuneCents);
      } catch {
        // A model download or inference failure should not prevent an upload.
        if (!encode) throw new Error("Couldn't run the key detector. Try again or enter the key manually.");
      }
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
