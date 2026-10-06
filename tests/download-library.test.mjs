import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/download-library.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { groupDownloads } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const purchase = (id, lease, track = "beat-a", array = false) => {
  const product = { id: `${track}:${lease}`, title: "breathe", bpm: 140, lease, catalog_track_id: track, catalog_tracks: array ? [{ cover_path: "art.jpg" }] : { cover_path: "art.jpg" } };
  return { id, download_products: array ? [product] : product };
};

test("groups formats by beat with cover, keeps newest grant and orders MP3 before WAV", () => {
  const entries = groupDownloads([purchase("new-wav", "wav"), purchase("mp3", "mp3", "beat-a", true), purchase("old-wav", "wav")]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].coverPath, "art.jpg");
  assert.deepEqual(entries[0].downloads, [{ purchaseId: "mp3", lease: "mp3" }, { purchaseId: "new-wav", lease: "wav" }]);
});

test("same-titled beats remain separate; WAV includes MP3 and MP3 cannot grant WAV", () => {
  const entries = groupDownloads([purchase("a", "wav"), purchase("b", "mp3", "beat-b")]);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[1].downloads, [{ purchaseId: "b", lease: "mp3" }]);
  assert.deepEqual(entries[0].downloads, [{ purchaseId: "a", lease: "mp3" }, { purchaseId: "a", lease: "wav" }]);
});

test("legacy unlinked products stay distinct and missing catalog art retains downloads", () => {
  const a = purchase("a", null);
  a.download_products.catalog_track_id = null;
  a.download_products.catalog_tracks = null;
  const b = purchase("b", null, "beat-b");
  b.download_products.catalog_track_id = null;
  b.download_products.catalog_tracks = [];
  const entries = groupDownloads([a, b, { id: "missing", download_products: null }]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].coverPath, null);
  assert.deepEqual(entries[0].downloads, [{ purchaseId: "a", lease: null }]);
});
