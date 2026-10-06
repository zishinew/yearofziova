import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const source = (await readFile(new URL("../src/app/loops/download-action.ts", import.meta.url), "utf8"))
 .replace('import { createClient } from "@supabase/supabase-js";', 'const createClient = () => globalThis.loopFixture.db;');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { downloadLoop } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const id = "952736f3-665d-43a5-ae52-5ceba1c75696";
function fixture(track, product) {
 const filters = []; const signed = [];
 globalThis.loopFixture = { db: {
  from(table) { const query = { select() { return query; }, eq(...args) { filters.push([table, ...args]); return query; }, is(...args) { filters.push([table, ...args]); return query; }, async maybeSingle() { return { data: table === "catalog_tracks" ? track : product, error: null }; } }; return query; },
  storage: { from(bucket) { return { async createSignedUrl(path, seconds, options) { signed.push({bucket, path, seconds, options}); return { data: { signedUrl: "https://example.test/download" }, error: null }; } }; } },
 } };
 return { filters, signed };
}
test("rejects missing agreement and invalid IDs before any database access", async () => {
 delete globalThis.loopFixture;
 assert.match((await downloadLoop(id, false)).error, /agree/);
 assert.match((await downloadLoop(id, "true")).error, /agree/);
 assert.match((await downloadLoop("bad-id", true)).error, /unavailable/);
});
test("only published, undeleted loops get short-lived download links; paid beat files stay protected", async t => {
 const previous = {url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY};
 process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test"; process.env.SUPABASE_SECRET_KEY = "fixture";
 t.after(() => { for (const [key,value] of [["NEXT_PUBLIC_SUPABASE_URL",previous.url],["SUPABASE_SECRET_KEY",previous.key]]) { if(value === undefined) delete process.env[key]; else process.env[key]=value; } delete globalThis.loopFixture; });
 const f = fixture({ id, title:"loop", preview_path:`${id}/listen.wav` }, {storage_path:`${id}/kit.zip`,download_name:"kit.zip"});
 assert.ok((await downloadLoop(id,true,"listener@example.com")).url);
 assert.deepEqual(f.filters.slice(0,4), [["catalog_tracks","id",id],["catalog_tracks","kind","loops"],["catalog_tracks","published",true],["catalog_tracks","deleted_at",null]]);
 assert.deepEqual(f.signed,[{bucket:"purchased-beats",path:`${id}/kit.zip`,seconds:60,options:{download:"kit.zip"}}]);
 const blocked = fixture(null,null);
 assert.match((await downloadLoop(id,true,"listener@example.com")).error,/unavailable/);
 assert.equal(blocked.signed.length,0);
 const audio = fixture({id,title:"loop",preview_path:`${id}/loop.wav`},null);
 assert.ok((await downloadLoop(id,true,"listener@example.com")).url);
 assert.equal(audio.signed[0].bucket,"track-previews");
 const wrongPath = fixture({id,title:"loop",preview_path:`${id}/loop.wav`},{storage_path:"another-track/file.wav",download_name:"file.wav"});
 assert.match((await downloadLoop(id,true,"listener@example.com")).error,/unavailable/);
 assert.equal(wrongPath.signed.length,0);
});

test("loop downloads require a valid email without requiring an account", async () => {
 delete globalThis.loopFixture;
 for (const email of [undefined, "", "invalid", "a @example.com"]) assert.match((await downloadLoop(id,true,email)).error, /valid email/);
});
