import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("purchase and storage policies isolate customers and revoke refunded downloads", async () => {
  const db = await PGlite.create();
  try {
    // Model the Supabase-owned schemas around the actual application migration.
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create schema storage;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, storage to anon, authenticated;
      create table storage.buckets (id text primary key, name text, public boolean);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
    `);
    const migration = await readFile(new URL("../supabase/migrations/20261002224637_customer_downloads.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.exec(`
      insert into auth.users values
        ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
      insert into public.download_products (id,title,storage_path,download_name) values
        ('a','Customer A beat','a.wav','a.wav'), ('b','Customer B beat','b.wav','b.wav'), ('c','Refunded beat','c.wav','c.wav');
      insert into public.purchases (user_id,product_id,status) values
        ('11111111-1111-4111-8111-111111111111','a','paid'),
        ('22222222-2222-4222-8222-222222222222','b','paid'),
        ('11111111-1111-4111-8111-111111111111','c','refunded');
      insert into storage.objects (bucket_id,name) values
        ('purchased-beats','a.wav'), ('purchased-beats','b.wav'), ('purchased-beats','c.wav'), ('purchased-beats','unowned.wav');
    `);
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.purchases"), /permission denied/);
    assert.equal((await db.query("select * from storage.objects")).rows.length, 0);

    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", ["11111111-1111-4111-8111-111111111111"]);
    assert.deepEqual((await db.query("select product_id from public.purchases where status='paid'")).rows, [{ product_id: "a" }]);
    assert.deepEqual((await db.query("select id from public.download_products")).rows, [{ id: "a" }]);
    assert.deepEqual((await db.query("select name from storage.objects")).rows, [{ name: "a.wav" }]);
    await assert.rejects(db.query("insert into public.purchases (user_id,product_id) values ('11111111-1111-4111-8111-111111111111','b')"), /permission denied/);
    await assert.rejects(db.query("update public.purchases set status='paid' where product_id='c'"), /permission denied/);
    await assert.rejects(db.query("insert into storage.objects (bucket_id,name) values ('purchased-beats','fake.wav')"), /row-level security/);

    await db.query("select set_config('request.jwt.claim.sub',$1,false)", ["22222222-2222-4222-8222-222222222222"]);
    assert.deepEqual((await db.query("select name from storage.objects")).rows, [{ name: "b.wav" }]);
    assert.equal((await db.query("select * from public.purchases where product_id='a'")).rows.length, 0);

    await db.exec("reset role; update public.purchases set status='refunded' where product_id='a'; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", ["11111111-1111-4111-8111-111111111111"]);
    assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
    assert.equal((await db.query("select * from public.download_products")).rows.length, 0);
  } finally {
    await db.close();
  }
});
