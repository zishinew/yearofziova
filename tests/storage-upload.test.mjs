import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const source = (await readFile(new URL("../src/lib/storage-upload.ts", import.meta.url), "utf8")).replace('await import("tus-js-client")', '({Upload: globalThis.tusFixture})');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { uploadStorageFile, storedBeatWav } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("large uploads use authenticated direct Storage with 6 MB chunks, refreshed credentials and progress", async t => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
  t.after(() => { delete globalThis.tusFixture; if(oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl; if(oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=oldKey; });
  let options; const headers = []; const messages = [];
  globalThis.tusFixture = class { constructor(file, config) { assert.equal(file.size, 100*1024*1024); options=config; } start() { options.onBeforeRequest({setHeader:(...args)=>headers.push(args)}).then(()=>{ options.onProgress(50,100); options.onSuccess({}); }); } };
  let count = 0;
  const client = { auth: { getSession: async () => ({data:{session:{access_token:++count === 1 ? "initial" : "refreshed"}},error:null}) } };
  await uploadStorageFile(client,"purchased-beats","track/source.wav",{name:"source.wav",size:100*1024*1024},"audio/wav",message=>messages.push(message));
  assert.equal(options.endpoint,"https://test-project.storage.supabase.co/storage/v1/upload/resumable");
  assert.equal(options.chunkSize,6*1024*1024); assert.equal(options.headers.authorization,"Bearer initial");
  assert.equal(options.headers["x-upsert"],"false"); assert.equal(options.removeFingerprintOnSuccess,true);
  assert.deepEqual(options.metadata,{bucketName:"purchased-beats",objectName:"track/source.wav",contentType:"audio/wav",cacheControl:"3600"});
  assert.deepEqual(headers,[["authorization","Bearer refreshed"]]); assert.match(messages[0],/50%/);
});
test("uploads reject empty sources and unauthenticated large transfers; small files retain server errors", async () => {
  await assert.rejects(uploadStorageFile({},"bucket","path",{size:0},"audio/wav",()=>{}),/non-empty/);
  const client = { auth:{getSession:async()=>({data:{session:null},error:null})} };
  await assert.rejects(uploadStorageFile(client,"bucket","path",{size:100*1024*1024},"audio/wav",()=>{}),/sign in again/);
  const small = {storage:{from:()=>({upload:async()=>({error:{message:"Access denied"}})})}};
  await assert.rejects(uploadStorageFile(small,"bucket","path",{name:"source.wav",size:10},"audio/wav",()=>{}),/Access denied/);
});
test("preview edits cannot fetch a private source without a matching authorized WAV", async () => {
  const filters = [];
  const query={select(){return this},eq(...args){filters.push(args);return this},single:async()=>({data:null,error:{message:"not found"}})};
  await assert.rejects(storedBeatWav({from:table=>{assert.equal(table,"download_products"); return query}},"track"),/original WAV/);
  assert.deepEqual(filters,[["catalog_track_id","track"],["lease","wav"]]);
});
