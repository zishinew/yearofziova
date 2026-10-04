import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const compile = source => ts.transpileModule(source, { compilerOptions: {module:ts.ModuleKind.ESNext} }).outputText;
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const payments = dataUrl(compile(await readFile(new URL("../src/lib/payments.ts",import.meta.url),"utf8")));
let source = await readFile(new URL("../src/app/api/checkout/route.ts",import.meta.url),"utf8");
source = source.replace('import { createServerSupabaseClient } from "@/lib/supabase/server";', 'const createServerSupabaseClient = () => globalThis.ownedCheckoutFixture.auth;')
  .replace('"@/lib/payments"',JSON.stringify(payments))
  .replace('import { paymentServices, siteOrigin } from "@/lib/stripe";', 'const paymentServices = () => globalThis.ownedCheckoutFixture.services; const siteOrigin = () => "http://localhost:3000";');
const {POST} = await import(dataUrl(compile(source)));

test("checkout rejects an already-owned format but allows a different lease", async () => {
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = "test-fixture";
  let sessions = 0;
  const db = {
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; },
        async in(_field, values) {
          if(table === "catalog_tracks") return {data:[{id,title:"Beat"}]};
          if(table === "download_products") return {data:["mp3","wav"].map(lease=>({id:`${id}:${lease}`,catalog_track_id:id,lease,storage_path:`file.${lease}`}))};
          if(table === "purchases") return {data:values.includes(`${id}:mp3`) ? [{product_id:`${id}:mp3`}] : []};
          throw Error("Unexpected query");
        },
        async insert() { return {error:null}; },
        update() { return {eq:async()=>({error:null})}; },
      };
      return query;
    },
    storage: {from:()=>({info:async()=>({data:{size:100}})})},
  };
  globalThis.ownedCheckoutFixture = {
    auth:{auth:{getUser:async()=>({data:{user:{id:"buyer",email:"buyer@example.com",email_confirmed_at:"confirmed"}}})}, from: () => ({select() {return this;},eq() {return this;},maybeSingle:async()=>({data:null,error:null})})},
    services:{db,stripe:{checkout:{sessions:{create:async()=>{sessions++;return {id:"cs_test",url:"https://checkout.stripe.com/test"};}}}}},
  };
  try {
    const request = lease => new Request("http://localhost:3000/api/checkout",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify({items:[{id,lease}]})});
    const owned = await POST(request("mp3"));
    assert.equal(owned.status,409); assert.equal(sessions,0);
    assert.match((await owned.json()).error,/already own/);
    const upgrade = await POST(request("wav"));
    assert.equal(upgrade.status,200); assert.equal(sessions,1);
  } finally {
    if(previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET=previous;
    delete globalThis.ownedCheckoutFixture;
  }
});


test("admin checkout is blocked before creating an order or calling Stripe", async () => {
  let providerCalled = false;
  globalThis.ownedCheckoutFixture = {
    auth: { auth: {getUser: async () => ({data:{user:{id:"admin",email_confirmed_at:"confirmed"}}})},
      from(table) { assert.equal(table,"admin_users"); return { select() {return this;}, eq(field,value) {assert.equal(field,"user_id");assert.equal(value,"admin");return this;}, maybeSingle:async()=>({data:{user_id:"admin"},error:null}) }; } },
    get services() { providerCalled = true; throw Error("Stripe should never be called"); },
  };
  try {
    const response = await POST(new Request("http://localhost:3000/api/checkout", {method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify({items:[{id,lease:"mp3"}]})}));
    assert.equal(response.status,403);
    assert.match((await response.json()).error,/Admin accounts cannot purchase/);
    assert.equal(providerCalled,false);
  } finally { delete globalThis.ownedCheckoutFixture; }
});
