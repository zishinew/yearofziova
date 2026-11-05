import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const trackUpload = await readFile(new URL("../src/lib/track-upload.ts", import.meta.url), "utf8");
const metadataCode = ts.transpileModule(trackUpload, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const metadataUrl = `data:text/javascript;base64,${Buffer.from(metadataCode).toString("base64")}`;
const source=(await readFile(new URL("../src/app/account/download-action.ts",import.meta.url),"utf8"))
 .replace('"@/lib/track-upload"', JSON.stringify(metadataUrl))
 .replace('import { createServiceSupabaseClient } from "@/lib/supabase/service";', 'const createServiceSupabaseClient=()=>globalThis.leaseFixture.db;')
 .replace('import { ownsOrder } from "@/lib/guest-checkout";', 'const ownsOrder=async()=>false;')
 .replace('import { createServerSupabaseClient } from "@/lib/supabase/server";', 'const createServerSupabaseClient=async()=>({auth:{getUser:async()=>({data:{user:{id:"buyer",email_confirmed_at:"confirmed"}}})}});');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {downloadPurchase}=await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("WAV includes MP3, but MP3 never grants WAV and another user's purchase grants nothing",async()=>{
 let lease="wav",owner="buyer",signed=[];
 const product = format => ({
  lease: format, catalog_track_id: id, storage_path: `beat.${format}`, download_name: `beat.${format}`,
  title: "journey to you", bpm: 134,
  catalog_tracks: {title:"journey to you",bpm:134,musical_key:"C Major",notes:["Detuned 50 cents"]},
 });
 globalThis.leaseFixture={db:{from(table){const q={select(){return q;},eq(){return q;},async single(){return {data:table==="purchases" ? {user_id:owner,checkout_orders:null,download_products:product(lease)} : product("mp3")};}};return q;},storage:{from(){return {async createSignedUrl(path, _expires, {download}){signed.push([path, download]);return {data:{signedUrl:"https://example.test/file"}};}};}}}};
 try {
  assert.ok((await downloadPurchase(id,"mp3")).url);
  assert.ok((await downloadPurchase(id,"wav")).url);
  assert.deepEqual(signed,[
   ["beat.mp3","journey to you 134bpm C Major detuned -50 cents @yearofziova.mp3"],
   ["beat.wav","journey to you 134bpm C Major detuned -50 cents @yearofziova.wav"],
  ]);
  signed=[];lease="mp3";
  assert.match((await downloadPurchase(id,"wav")).error,/isn't included/);assert.equal(signed.length,0);
  lease="wav";owner="other";
  assert.match((await downloadPurchase(id,"mp3")).error,/unavailable/);assert.equal(signed.length,0);
 } finally {delete globalThis.leaseFixture;}
});
