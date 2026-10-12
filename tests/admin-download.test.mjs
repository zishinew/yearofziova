import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const source=(await readFile(new URL("../src/app/admin/download-action.ts",import.meta.url),"utf8"))
 .replace('import { getAdminSession } from "@/lib/supabase/admin";', 'const getAdminSession=async()=>globalThis.adminDownloadFixture;');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {getAdminDownloadFiles,downloadAdminTrack}=await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("admin downloads require server-verified membership for every request",async()=>{
 globalThis.adminDownloadFixture=null;
 assert.match((await getAdminDownloadFiles(id)).error,/Admin access/);
 assert.match((await downloadAdminTrack(id,`${id}:wav`)).error,/Admin access/);
 delete globalThis.adminDownloadFixture;
});
test("admins can download private formats and loop originals; forged files and paths are rejected",async()=>{
 const signed=[];let products=[{id:`${id}:wav`,lease:"wav",storage_path:`${id}/full.wav`,download_name:"beat.wav"},{id:`${id}:mp3`,lease:"mp3",storage_path:`${id}/full.mp3`,download_name:"beat.mp3"}];
 let track={id,title:"beat",kind:"beats",preview_path:`${id}/audio.mp3`,cover_path:`${id}/art.png`};
 globalThis.adminDownloadFixture={supabase:{from(table){const q={select(){return q;},eq(){return q;},is(){return q;},async maybeSingle(){return {data:track};},async or(){assert.equal(table,"download_products");return {data:products};}};return q;},storage:{from(bucket){return {async createSignedUrl(path,seconds,options){signed.push({bucket,path,seconds,options});return {data:{signedUrl:"https://example.test/file"}};}};}}}};
 try {
  assert.match((await getAdminDownloadFiles("bad-id")).error,/unavailable/);
  const list=await getAdminDownloadFiles(id);
  assert.deepEqual(list.files.map(file=>file.label),["Download WAV","Download MP3","Download cover art"]);
  assert.ok(list.files.every(file=>!Object.hasOwn(file,"path")));
  assert.ok((await downloadAdminTrack(id,`${id}:wav`)).url);
  assert.deepEqual(signed[0],{bucket:"purchased-beats",path:`${id}/full.wav`,seconds:60,options:{download:"beat.wav"}});
  assert.match((await downloadAdminTrack(id,"another-track/file.wav")).error,/unavailable/);
  assert.equal(signed.length,1);
  products=[{id,lease:null,storage_path:`${id}/kit.zip`,download_name:"kit.zip"}];track={...track,kind:"loops",cover_path:null};
  assert.ok((await downloadAdminTrack(id,id)).url);
  assert.equal(signed[1].path,`${id}/kit.zip`);
  products=[{id,storage_path:"other-track/private.wav",download_name:"private.wav"}];
  assert.match((await downloadAdminTrack(id,id)).error,/unavailable/);
  track=null;
  assert.match((await getAdminDownloadFiles(id)).error,/unavailable/);
 } finally {delete globalThis.adminDownloadFixture;}
});
