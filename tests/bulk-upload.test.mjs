import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const trackUpload = url(compile(await readFile(new URL("../src/lib/track-upload.ts", import.meta.url), "utf8")));
const planSource = (await readFile(new URL("../src/lib/bulk-upload-plan.ts", import.meta.url), "utf8")).replace('"@/lib/track-upload"', JSON.stringify(trackUpload));
const { planBulkUpload } = await import(url(compile(planSource)));
const workerSource = (await readFile(new URL("../src/lib/bulk-track-upload.ts", import.meta.url), "utf8"))
  .replace('"@/lib/track-upload"', JSON.stringify(trackUpload))
  .replace('import { createBrowserSupabaseClient } from "@/lib/supabase/browser";', 'const createBrowserSupabaseClient = () => globalThis.bulkFixture.client;')
  .replace('import { saveTrack } from "@/app/admin/actions";', 'const saveTrack = (...args) => globalThis.bulkFixture.save(...args);')
  .replace('await import("@/lib/wav-to-mp3")', '({ wavToMp3: globalThis.bulkFixture.convert })');
const { bulkTrackError, uploadBulkTrack } = await import(url(compile(workerSource)));
const file = (name, path = name, size = 100) => ({ name, webkitRelativePath: path, size });

test("folder planning imports WAV beats with parsed BPM, matching art and distinct nested paths", () => {
  const art = file("cover.jpg", "drop/a/cover.jpg");
  const exact = file("breathe_140bpm.png", "drop/b/breathe_140bpm.png");
  const entries = planBulkUpload([
    file("breathe_140bpm.wav", "drop/a/breathe_140bpm.wav"), art,
    file("breathe_140bpm.mp3", "drop/a/breathe_140bpm.mp3"),
    file("breathe_140bpm.wav", "drop/b/breathe_140bpm.wav"), exact,
    file("hidden.wav", "drop/.hidden/hidden.wav"), file("._bad.wav", "drop/._bad.wav"),
  ], "beats");
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(entry => [entry.title, entry.bpm]), [["breathe", 140], ["breathe", 140]]);
  assert.equal(entries[0].cover, art);
  assert.equal(entries[1].cover, exact);
});

test("loop ZIPs consume their matching preview; missing previews and ambiguous covers stay unset", () => {
  const preview = file("kit_120bpm-preview.mp3");
  const entries = planBulkUpload([file("kit_120bpm.zip"), preview, file("other.zip"), file("loop_80bpm.wav"), file("a.png"), file("b.jpg")], "loops");
  assert.equal(entries.length, 3);
  assert.equal(entries.find(entry => entry.file.name.endsWith("120bpm.zip")).preview, preview);
  assert.equal(entries.find(entry => entry.file.name === "other.zip").preview, null);
  assert.ok(entries.every(entry => entry.cover === null));
});

test("bulk preflight rejects missing BPM, oversized files and ZIPs without a preview", () => {
  const entry = { id: crypto.randomUUID(), file: file("beat.wav"), preview: null, cover: null, title: "beat", bpm: "140" };
  assert.equal(bulkTrackError(entry, "beats"), null);
  assert.match(bulkTrackError({ ...entry, bpm: "" }, "beats"), /BPM/);
  assert.match(bulkTrackError({ ...entry, file: file("big.wav", "big.wav", 51 * 1024 * 1024) }, "beats"), /50 MB/);
  assert.match(bulkTrackError({ ...entry, file: file("kit.zip") }, "loops"), /preview/);
});

function fixture(t, failSave = false) {
  const uploads = []; const removals = []; const saves = [];
  globalThis.bulkFixture = {
    client: { storage: { from: bucket => ({ upload: async (path, file, options) => { uploads.push({ bucket, path, file, options }); return { error: null }; }, remove: async paths => { removals.push({ bucket, paths }); return { error: null }; } }) } },
    convert: async () => ({ mp3: file("beat.mp3"), preview: file("beat-preview.mp3"), duration: 137 }),
    save: async (...args) => { saves.push(args); return failSave ? { error: "Save failed" } : {}; },
  };
  t.after(() => { delete globalThis.bulkFixture; });
  return { uploads, removals, saves };
}

test("bulk WAV upload keeps lease files private, uploads preview separately and saves both leases atomically", async t => {
  const f = fixture(t);
  const id = crypto.randomUUID();
  await uploadBulkTrack({ id, file: file("beat.wav"), cover: file("cover.png"), preview: null, title: " beat ", bpm: "140" }, "beats", true, ["rage"], ["note"], () => {});
  assert.equal(f.uploads.length, 4);
  assert.ok(f.uploads.every(upload => upload.path.startsWith(`${id}/`) && upload.options.upsert === false));
  assert.equal(f.uploads.find(upload => upload.file.name === "beat-preview.mp3").bucket, "track-previews");
  assert.ok(f.uploads.filter(upload => ["beat.mp3", "beat.wav"].includes(upload.file.name)).every(upload => upload.bucket === "purchased-beats"));
  const [track, download, , leases] = f.saves[0];
  assert.equal(track.title, "beat"); assert.equal(track.duration_seconds, 137);
  assert.deepEqual(track.tags, ["rage"]); assert.deepEqual(track.notes, ["note"]);
  assert.equal(download, undefined);
  assert.deepEqual(leases.map(lease => lease.lease), ["mp3", "wav"]);
  assert.deepEqual(f.removals, []);
});

test("a failed save cleans up that track's uploaded files and propagates the error for retry", async t => {
  const f = fixture(t, true);
  await assert.rejects(uploadBulkTrack({ id: crypto.randomUUID(), file: file("beat.wav"), cover: null, preview: null, title: "beat", bpm: "140" }, "beats", false, [], [], () => {}), /Save failed/);
  assert.equal(f.removals.length, f.uploads.length);
  assert.deepEqual(f.removals.flatMap(item => item.paths).sort(), f.uploads.map(item => item.path).sort());
});

test("loop ZIP upload saves a private archive and its separate public preview without beat leases", async t => {
  const f = fixture(t);
  const previous = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = class { async decodeAudioData() { return { duration: 30 }; } };
  t.after(() => { if (previous === undefined) delete globalThis.OfflineAudioContext; else globalThis.OfflineAudioContext = previous; });
  const preview = { ...file("kit-preview.mp3"), arrayBuffer: async () => new ArrayBuffer(12) };
  await uploadBulkTrack({ id: crypto.randomUUID(), file: file("kit.zip"), cover: null, preview, title: "kit", bpm: "120" }, "loops", false, [], [], () => {});
  assert.equal(f.uploads.find(upload => upload.file.name === "kit.zip").bucket, "purchased-beats");
  assert.equal(f.uploads.find(upload => upload.file.name === "kit-preview.mp3").bucket, "track-previews");
  const [track, path, name, leases] = f.saves[0];
  assert.equal(track.published, false); assert.equal(track.kind, "loops");
  assert.equal(name, "kit.zip"); assert.ok(path.endsWith(".zip"));
  assert.deepEqual(leases, []);
});
