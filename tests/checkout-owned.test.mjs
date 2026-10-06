import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const compile = source => ts.transpileModule(source, { compilerOptions: {module:ts.ModuleKind.ESNext} }).outputText;
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const payments = dataUrl(compile(await readFile(new URL("../src/lib/payments.ts",import.meta.url),"utf8")));
let source = await readFile(new URL("../src/app/api/checkout/route.ts",import.meta.url),"utf8");
source = source.replace('import { cookies } from "next/headers";', 'const cookies = async () => ({ set: (...args) => globalThis.ownedCheckoutFixture.cookie = args });')
  .replace('import { guestCookieName, guestTokenHash, newGuestToken } from "@/lib/guest-checkout";', 'const guestCookieName = id => `ziova-guest-${id}`; const guestTokenHash = token => "b".repeat(64); const newGuestToken = () => "a".repeat(64);')
  .replace('import { createServerSupabaseClient } from "@/lib/supabase/server";', 'const createServerSupabaseClient = () => globalThis.ownedCheckoutFixture.auth;')
  .replace('"@/lib/payments"',JSON.stringify(payments))
  .replace('import { paymentServices, siteOrigin } from "@/lib/stripe";', 'const paymentServices = () => globalThis.ownedCheckoutFixture.services; const siteOrigin = () => "http://localhost:3000";');
const {POST} = await import(dataUrl(compile(source)));

test("checkout rejects an already-owned format but allows a different lease", async () => {
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = "test-fixture";
  let sessions = 0;
  let ownedLease = "mp3";
  const db = {
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; },
        async in() {
          if(table === "catalog_tracks") return {data:[{id,title:"Beat"}]};
          if(table === "download_products") return {data:["mp3","wav"].map(lease=>({id:`${id}:${lease}`,catalog_track_id:id,lease,storage_path:`file.${lease}`}))};
          if(table === "purchases") return {data:[{product_id:`${id}:${ownedLease}`,download_products:{catalog_track_id:id,lease:ownedLease}}]};
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
    services:{db,stripe:{checkout:{sessions:{create:async params=>{assert.deepEqual(params.managed_payments,{enabled:false});assert.deepEqual(params.adaptive_pricing,{enabled:false});sessions++;return {id:"cs_test",url:"https://checkout.stripe.com/test"};}}}}},
  };
  try {
    const request = lease => new Request("http://localhost:3000/api/checkout",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify({items:[{id,lease}]})});
    const owned = await POST(request("mp3"));
    assert.equal(owned.status,409); assert.equal(sessions,0);
    assert.match((await owned.json()).error,/already own/);
    const upgrade = await POST(request("wav"));
    assert.equal(upgrade.status,200); assert.equal(sessions,1);
    ownedLease = "wav";
    assert.equal((await POST(request("mp3"))).status,409);
    assert.equal((await POST(request("wav"))).status,409);
    assert.equal(sessions,1);
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

test("guest checkout uses email without an account and issues a private order cookie", async () => {
 const previous=process.env.STRIPE_WEBHOOK_SECRET;
 process.env.STRIPE_WEBHOOK_SECRET="fixture";
 let savedOrder, sessionParams;
 const db={from(table){const query={select(){return query;},eq(){return query;},async in(){
  if(table==="catalog_tracks")return {data:[{id,title:"Beat"}]};
  if(table==="download_products")return {data:[{id:`${id}:mp3`,catalog_track_id:id,lease:"mp3",storage_path:"file.mp3"}]};
  throw Error("Guests must not look up another customer's purchases");
 },async insert(order){savedOrder=order;return {error:null};},update(){return {eq:async()=>({error:null})};}};return query;},storage:{from:()=>({info:async()=>({data:{size:100}})})}};
 globalThis.ownedCheckoutFixture={auth:{auth:{getUser:async()=>({data:{user:null}})}},services:{db,stripe:{checkout:{sessions:{create:async params=>{sessionParams=params;return {id:"cs_test_guest",url:"https://checkout.stripe.com/test"};}}}}}};
 try {
  const request=email=>new Request("http://localhost:3000/api/checkout",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify({email,items:[{id,lease:"mp3"}]})});
  assert.equal((await POST(request("invalid"))).status,400);
  assert.equal(savedOrder,undefined);
  assert.equal((await POST(request(" Guest@Example.com "))).status,200);
  assert.equal(savedOrder.user_id,null);
  assert.equal(savedOrder.currency,"usd");
  assert.equal(sessionParams.line_items[0].price_data.currency,"usd");
  assert.equal(savedOrder.guest_email,"guest@example.com");
  assert.equal(sessionParams.client_reference_id,savedOrder.id);
  assert.equal(sessionParams.customer_email,savedOrder.guest_email);
  const [name,token,options]=globalThis.ownedCheckoutFixture.cookie;
  assert.equal(name,`ziova-guest-${savedOrder.id}`);
  assert.notEqual(token,savedOrder.guest_token_hash);
  assert.equal(options.httpOnly,true);assert.equal(options.sameSite,"lax");
 } finally {if(previous===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;else process.env.STRIPE_WEBHOOK_SECRET=previous;delete globalThis.ownedCheckoutFixture;}
});
