import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const source=(await readFile(new URL("../src/app/account/download-action.ts",import.meta.url),"utf8"))
 .replace('import { paymentServices } from "@/lib/stripe";', 'const paymentServices=()=>({db:globalThis.leaseFixture.db});')
 .replace('import { ownsOrder } from "@/lib/guest-checkout";', 'const ownsOrder=async()=>false;')
 .replace('import { createServerSupabaseClient } from "@/lib/supabase/server";', 'const createServerSupabaseClient=async()=>({auth:{getUser:async()=>({data:{user:{id:"buyer",email_confirmed_at:"confirmed"}}})}});');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {downloadPurchase}=await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("WAV includes MP3, but MP3 never grants WAV and another user's purchase grants nothing",async()=>{
 let lease="wav",owner="buyer",signed=[];
 globalThis.leaseFixture={db:{from(table){const q={select(){return q;},eq(){return q;},async single(){return {data:table==="purchases" ? {user_id:owner,checkout_orders:null,download_products:{lease,catalog_track_id:id,storage_path:`beat.${lease}`,download_name:`beat.${lease}`}} : {lease:"mp3",catalog_track_id:id,storage_path:"beat.mp3",download_name:"beat.mp3"}};}};return q;},storage:{from(){return {async createSignedUrl(path){signed.push(path);return {data:{signedUrl:"https://example.test/file"}};}};}}}};
 try {
  assert.ok((await downloadPurchase(id,"mp3")).url);assert.deepEqual(signed,["beat.mp3"]);
  signed=[];lease="mp3";
  assert.match((await downloadPurchase(id,"wav")).error,/isn't included/);assert.equal(signed.length,0);
  lease="wav";owner="other";
  assert.match((await downloadPurchase(id,"mp3")).error,/unavailable/);assert.equal(signed.length,0);
 } finally {delete globalThis.leaseFixture;}
});
