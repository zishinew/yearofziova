import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const modeUrl=url(compile(await readFile(new URL("../src/lib/stripe-mode.ts",import.meta.url),"utf8")));
const {stripeKeyMode}=await import(modeUrl);
const fulfillmentSource=(await readFile(new URL("../src/lib/checkout-fulfillment.ts",import.meta.url),"utf8"))
 .replace('import "server-only";','')
 .replace('import { paymentServices } from "@/lib/stripe";','const paymentServices=()=>({stripe:{checkout:{sessions:{retrieve:async()=>globalThis.modeSession}}},db:{}});')
 .replace('"@/lib/stripe-mode"',JSON.stringify(modeUrl));
const {fulfillSession,processPaymentEvent}=await import(url(compile(fulfillmentSource)));
const servicesSource=(await readFile(new URL("../src/lib/stripe.ts",import.meta.url),"utf8"))
 .replace('import "server-only";','')
 .replace('import Stripe from "stripe";','class Stripe {}')
 .replace('import { createClient } from "@supabase/supabase-js";','const createClient=()=>({});')
 .replace('"@/lib/stripe-mode"',JSON.stringify(modeUrl));
const {paymentServices}=await import(url(compile(servicesSource)));

test("recognizes restricted and standard server keys, rejects public and malformed credentials",()=>{
 for(const prefix of ["sk","rk"]) for(const mode of ["test","live"]) assert.equal(stripeKeyMode(`${prefix}_${mode}_fixture`),mode);
 for(const key of [undefined,"","pk_live_fixture","pk_test_fixture","sk_org_fixture","rk_live_"," rk_live_fixture","wrong"]) assert.equal(stripeKeyMode(key),null);
});
test("restricted live keys confirm live sessions and webhooks while rejecting sandbox events; live opt-in remains required",async t=>{
 const names=["STRIPE_SECRET_KEY","SUPABASE_SECRET_KEY","NEXT_PUBLIC_SUPABASE_URL","STRIPE_LIVE_PAYMENTS","VERCEL_ENV"];
 const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 t.after(()=>{for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}delete globalThis.modeSession;});
 process.env.SUPABASE_SECRET_KEY="fixture";process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.test";
 delete process.env.VERCEL_ENV;
 for(const prefix of ["sk","rk"]){
  process.env.STRIPE_SECRET_KEY=`${prefix}_live_fixture`;process.env.STRIPE_LIVE_PAYMENTS="false";
  assert.throws(paymentServices,/Live payments are not enabled/);
  process.env.STRIPE_LIVE_PAYMENTS="true";assert.ok(paymentServices().stripe);
  globalThis.modeSession={livemode:true,payment_status:"unpaid"};await fulfillSession("cs_live_fixture");
  await processPaymentEvent({type:"irrelevant",livemode:true});
  globalThis.modeSession={livemode:false,payment_status:"unpaid"};await assert.rejects(fulfillSession("cs_test_fixture"),/environment mismatch/);
  await assert.rejects(processPaymentEvent({type:"irrelevant",livemode:false}),/environment mismatch/);
  process.env.STRIPE_SECRET_KEY=`${prefix}_test_fixture`;process.env.STRIPE_LIVE_PAYMENTS="false";
  assert.ok(paymentServices().stripe);await fulfillSession("cs_test_fixture");
  await assert.rejects(processPaymentEvent({type:"irrelevant",livemode:true}),/environment mismatch/);
 }
 process.env.STRIPE_SECRET_KEY="pk_live_fixture";assert.throws(paymentServices,/not configured/);
 process.env.VERCEL_ENV="preview";process.env.STRIPE_LIVE_PAYMENTS="true";
 for(const prefix of ["sk","rk"]){
  process.env.STRIPE_SECRET_KEY=`${prefix}_live_fixture`;
  assert.throws(paymentServices,/Preview deployments require sandbox/);
  process.env.STRIPE_SECRET_KEY=`${prefix}_test_fixture`;
  assert.ok(paymentServices().stripe);
 }
});
