import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const source = await readFile(new URL("../src/lib/audio-preview.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { previewChannels } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("default and chosen previews contain the right samples and preserve the full stereo beat", () => {
  const channels = [Float32Array.from({length:1000}, (_,i)=>i), Float32Array.from({length:1000}, (_,i)=>-i)];
  const first = previewChannels(channels,10);
  assert.equal(first[0].length,300); assert.equal(first[0][0],0); assert.equal(first[0][299],299);
  const selected = previewChannels(channels,10,45.5);
  assert.equal(selected[0].length,300); assert.equal(selected[0][0],455); assert.equal(selected[1][299],-754);
  const end = previewChannels(channels,10,90);
  assert.equal(end[0].length,100); assert.equal(end[0][99],999);
  assert.equal(channels[0].length,1000); assert.equal(channels[0][999],999);
});
test("short beats play entirely; invalid starts fail instead of generating empty audio", () => {
  assert.equal(previewChannels([new Float32Array(100)],10)[0].length,100);
  for (const start of [-1,NaN,Infinity,10]) assert.throws(()=>previewChannels([new Float32Array(100)],10,start),/Preview start/);
  assert.throws(()=>previewChannels([new Float32Array(100), new Float32Array(50)],10),/Invalid audio/);
});
