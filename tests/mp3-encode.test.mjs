import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const source = await readFile(new URL("../src/lib/mp3-encode.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace('"@breezystack/lamejs"', JSON.stringify(import.meta.resolve("@breezystack/lamejs")));
const { encodeMp3 } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
test("encodes mono and stereo PCM as real 320 kbps MPEG-1 layer III audio", async () => {
  for (const count of [1, 2]) {
    const channels = Array.from({ length: count }, (_, channel) => Float32Array.from({ length: 44100 * 2 }, (_, i) => 0.4 * Math.sin(2 * Math.PI * (channel ? 880 : 440) * i / 44100)));
    const progress = [];
    const result = new Uint8Array(encodeMp3(channels, 44100, percent => progress.push(percent)));
    assert.equal(result[0], 0xff);
    assert.equal(result[1] & 0xfe, 0xfa); // MPEG-1, layer III sync/version/layer.
    assert.equal(result[2] >> 4, 14); // 320 kbps bitrate index.
    assert.equal((result[2] >> 2) & 3, 0); // 44.1 kHz.
    assert.equal(result[3] >> 6 === 3, count === 1);
    assert.ok(result.length > 79000 && result.length < 84000);
    assert.equal(progress.at(-1), 100);
    // A local artifact also allows independent decoder verification during development.
    if (process.env.MP3_VERIFY_OUTPUT) await writeFile(`${process.env.MP3_VERIFY_OUTPUT}-${count}.mp3`, result);
  }
});
test("rejects empty, mismatched, surround or unsupported PCM", () => {
  for (const channels of [[], [new Float32Array()], [new Float32Array(5),new Float32Array(6)], Array(3).fill(new Float32Array(5))]) assert.throws(() => encodeMp3(channels,44100));
  assert.throws(() => encodeMp3([new Float32Array(5)],96000));
});
