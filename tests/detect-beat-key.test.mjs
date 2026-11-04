import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/detect-beat-key.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { detectBeatKey } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const sampleRate = 44_100;
const cMajor = [[48, 60, 64, 67], [53, 60, 65, 69], [55, 59, 62, 67], [48, 60, 64, 67]];
const aMinor = [[45, 60, 64, 69], [45, 59, 62, 67], [45, 60, 64, 72], [45, 60, 64, 69]];

function makeBeat(chords, cents, melodyLevel) {
  const frequencies = chords.map(chord => chord.map(note => 2 * Math.PI * 440 * 2 ** ((note - 69 + cents / 100) / 12)));
  let seed = 19;
  return Float32Array.from({ length: sampleRate * 16 }, (_, i) => {
    const t = i / sampleRate;
    const beat = t % 0.5;
    const [bass, ...notes] = frequencies[Math.floor(t / 2) % chords.length];
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const noise = seed / 2 ** 32 - 0.5;
    const kick = 0.6 * Math.exp(-beat * 25) * Math.sin(2 * Math.PI * (41 * beat + 2.2 * (1 - Math.exp(-beat * 40))));
    const hat = 0.25 * Math.exp(-(t % 0.25) * 80) * noise;
    const sub = (0.55 * Math.sin(bass * t / 2) + 0.15 * Math.sin(bass * t) + 0.07 * Math.sin(bass * t * 1.5)) * Math.exp(-beat * 1.5);
    const melody = notes.reduce((sum, pitch, j) => {
      const tone = Math.sin(pitch * t) + 0.25 * Math.sin(pitch * 2 * t) + 0.14 * Math.sin(pitch * 3 * t);
      return sum + melodyLevel * tone / (1 + j * 0.3);
    }, 0);
    return sub + melody + kick + hat + 0.025 * noise;
  });
}

test("quiet chords remain detectable over a loud 808 and percussion", () => {
  assert.equal(detectBeatKey([makeBeat(cMajor, 0, 0.013)], sampleRate), "C major");
  assert.equal(detectBeatKey([makeBeat(aMinor, 0, 0.013)], sampleRate), "A minor");
});

test("a declared half semitone shift preserves the original key", () => {
  assert.equal(detectBeatKey([makeBeat(cMajor, -50, 0.022)], sampleRate, -50), "C major");
  assert.equal(detectBeatKey([makeBeat(aMinor, 50, 0.022)], sampleRate, 50), "A minor");
});

test("silence and an isolated bass note with percussion have no major or minor label", () => {
  assert.equal(detectBeatKey([new Float32Array(sampleRate * 8)], sampleRate), "");
  assert.equal(detectBeatKey([makeBeat([[48]], 0, 0)], sampleRate), "");
});
