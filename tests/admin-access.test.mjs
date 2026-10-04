import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("only an assigned admin can upload and publish; public catalogs exclude drafts and private files", async () => {
  const db = await PGlite.create();
  const owner = "11111111-1111-4111-8111-111111111111";
  const customer = "22222222-2222-4222-8222-222222222222";
  const beat = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const loop = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const track = (id, published, kind = "beats") => ({
    id, kind, title: "Policy test", bpm: 140, duration_seconds: 60,
    genre: "", musical_key: "", description: "", moods: [], tags: [], notes: [],
    preview_path: `${id}/preview.mp3`, cover_path: null, published,
  });
  const asUser = async id => {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  };
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, storage to anon, authenticated;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
    `);
    for (const file of ["20261002224637_customer_downloads.sql", "20261002234529_admin_catalog_uploads.sql", "20261002235432_consolidate_catalog_policies.sql", "20261004160132_archive_catalog_tracks.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.query("insert into auth.users(id) values ($1),($2)", [owner, customer]);
    await db.query("insert into public.admin_users(user_id) values ($1)", [owner]);
    await asUser(owner);
    for (const id of [beat, loop]) {
      await db.query("insert into storage.objects(bucket_id,name) values ('track-previews',$1),('purchased-beats',$2)", [`${id}/preview.mp3`, `${id}/full.wav`]);
    }
    await db.query("select public.save_catalog_track($1::jsonb,$2,$3)", [JSON.stringify(track(beat, true)), `${beat}/full.wav`, "beat.wav"]);
    await db.query("select public.save_catalog_track($1::jsonb,$2,$3)", [JSON.stringify(track(loop, false, "loops")), `${loop}/full.wav`, "loop.wav"]);
    assert.equal((await db.query("select * from public.catalog_tracks")).rows.length, 2);
    assert.equal((await db.query("select * from public.download_products")).rows.length, 2);
    // Live references cannot be removed, even by an admin's cleanup request.
    assert.equal((await db.query("delete from storage.objects where name=$1 returning id", [`${beat}/full.wav`])).rows.length, 0);

    await db.exec("reset role; set role anon");
    assert.deepEqual((await db.query("select id from public.catalog_tracks")).rows, [{ id: beat }]);
    await assert.rejects(db.query("select * from public.admin_users"), /permission denied/);
    await assert.rejects(db.query("select public.save_catalog_track('{}'::jsonb)"), /permission denied/);

    await asUser(customer);
    assert.equal((await db.query("select * from public.admin_users")).rows.length, 0);
    assert.equal((await db.query("select * from public.download_products")).rows.length, 0);
    assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
    assert.deepEqual((await db.query("select id from public.catalog_tracks")).rows, [{ id: beat }]);
    await assert.rejects(db.query("insert into public.admin_users(user_id) values ($1)", [customer]), /permission denied/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('track-previews','fake.mp3')"), /row-level security/);
    await assert.rejects(db.query("select public.save_catalog_track($1::jsonb)", [JSON.stringify(track(beat, false))]), /Admin access required/);
    assert.equal((await db.query("update public.catalog_tracks set title='Forged' where id=$1 returning id", [beat])).rows.length, 0);

    await asUser(owner);
    await db.query("update public.catalog_tracks set published=true where id=$1", [loop]);
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select * from public.catalog_tracks")).rows.length, 2);
    await asUser(owner);
    await db.query("update public.catalog_tracks set published=false where id=$1", [beat]);
    await db.exec("reset role; set role anon");
    assert.deepEqual((await db.query("select id from public.catalog_tracks")).rows, [{ id: loop }]);

    // Customers cannot delete listings; admins can remove them without deleting deliverables.
    await db.exec("reset role");
    await db.query("insert into public.purchases(user_id,product_id) values ($1,$2)", [customer, loop]);
    await asUser(customer);
    assert.equal((await db.query("update public.catalog_tracks set published=false,deleted_at=now() where id=$1 returning id", [loop])).rows.length, 0);
    await asUser(owner);
    await db.query("update public.catalog_tracks set published=false,deleted_at=now() where id=$1", [loop]);
    assert.deepEqual((await db.query("select id from public.catalog_tracks where deleted_at is null")).rows, [{ id: beat }]);
    assert.equal((await db.query("select * from public.download_products")).rows.length, 2);
    await assert.rejects(db.query("update public.catalog_tracks set published=true where id=$1", [loop]), /deleted_tracks_not_published/);
    await asUser(customer);
    assert.equal((await db.query("select * from public.download_products")).rows.length, 1);
    assert.equal((await db.query("select * from storage.objects where bucket_id='purchased-beats'")).rows.length, 1);
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select * from public.catalog_tracks")).rows.length, 0);

    // Revoking membership blocks an existing session immediately.
    await db.exec("reset role");
    await db.query("delete from public.admin_users where user_id=$1", [owner]);
    await asUser(owner);
    await assert.rejects(db.query("select public.save_catalog_track($1::jsonb)", [JSON.stringify(track(beat, true))]), /Admin access required/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('purchased-beats','fake.wav')"), /row-level security/);
  } finally { await db.close(); }
});
