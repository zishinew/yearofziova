import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const compile = source => ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const trackUpload = url(compile(await readFile(new URL("../src/lib/track-upload.ts",import.meta.url),"utf8")));
const source = (await readFile(new URL("../src/app/admin/actions.ts",import.meta.url),"utf8"))
 .replace('import { revalidatePath } from "next/cache";', 'const revalidatePath = () => {};')
 .replace('import { getAdminSession } from "@/lib/supabase/admin";', 'const getAdminSession = async () => globalThis.editFixture;')
 .replace('"@/lib/track-upload"',JSON.stringify(trackUpload));
const {getEditableTrack} = await import(url(compile(source)));

test("catalog editor requires verified admin membership and excludes archived tracks", async () => {
 const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 globalThis.editFixture = null;
 assert.match((await getEditableTrack(id)).error,/Admin access required/);
 const filters = [];
 const track = {id,title:"Beat",kind:"beats"};
 globalThis.editFixture = {supabase:{from(table) {
  assert.equal(table,"catalog_tracks");
  return {select() {return this;},eq(...args) {filters.push(args);return this;},is(...args) {filters.push(args);return this;},maybeSingle:async()=>({data:track,error:null})};
 }}};
 try {
  assert.match((await getEditableTrack("bad-id")).error,/unavailable/);
  assert.equal(filters.length,0);
  assert.deepEqual(await getEditableTrack(id),{track});
  assert.deepEqual(filters,[["id",id],["deleted_at",null]]);
 } finally {delete globalThis.editFixture;}
});
