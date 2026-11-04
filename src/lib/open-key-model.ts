import { env, InferenceSession, Tensor } from "onnxruntime-web/wasm";
import { keyBins, openKeyFeatures } from "./open-key-features";

const camelotKeys = [
  "A♭ minor", "E♭ minor", "B♭ minor", "F minor", "C minor", "G minor",
  "D minor", "A minor", "E minor", "B minor", "F♯ minor", "C♯ minor",
  "B major", "F♯ major", "C♯ major", "A♭ major", "E♭ major", "B♭ major",
  "F major", "C major", "G major", "D major", "A major", "E major",
];

export function rankOpenKeys(logits: Float32Array) {
  if (logits.length !== camelotKeys.length || !logits.every(Number.isFinite)) return null;
  const max = Math.max(...logits);
  const probabilities = Array.from(logits, logit => Math.exp(logit - max));
  const sum = probabilities.reduce((total, value) => total + value, 0);
  const [best, second] = probabilities
    .map((value, index) => ({ key: camelotKeys[index], score: value / sum }))
    .sort((a, b) => b.score - a.score);
  return { ...best, margin: best.score - second.score };
}

export function selectOpenKey(logits: Float32Array) {
  const estimate = rankOpenKeys(logits);
  // These scores rank candidates and are not calibrated probabilities.
  return estimate && estimate.score >= 0.5 && estimate.margin >= 0.15 ? estimate.key : "";
}

export async function detectOpenKey(channels: Float32Array[], sampleRate: number, detuneCents?: number) {
  const features = openKeyFeatures(channels, sampleRate, detuneCents);
  if (!features) return "";
  env.wasm.numThreads = 1;
  env.wasm.wasmPaths = {
    wasm: new URL("onnxruntime-web/ort-wasm-simd-threaded.wasm", import.meta.url).href,
  };
  const modelUrl = new URL("/key-model/openkeyscan2.onnx", self.location.origin).href;
  const session = await InferenceSession.create(modelUrl, { executionProviders: ["wasm"] });
  try {
    const input = new Tensor("float32", features.data, [1, 1, keyBins, features.frames]);
    const { logits } = await session.run({ cqt: input });
    return selectOpenKey(logits.data as Float32Array);
  } finally {
    await session.release();
  }
}
