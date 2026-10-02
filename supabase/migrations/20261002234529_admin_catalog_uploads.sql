create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
grant all on public.admin_users to service_role;
create policy "Admins can read their own membership" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

create table public.catalog_tracks (
  id uuid primary key,
  kind text not null check (kind in ('beats', 'loops')),
  title text not null check (length(trim(title)) between 1 and 120),
  bpm integer not null check (bpm between 1 and 400),
  duration_seconds integer check (duration_seconds between 1 and 86400),
  genre text not null default '' check (length(genre) <= 120),
  musical_key text not null default '' check (length(musical_key) <= 40),
  description text not null default '' check (length(description) <= 2000),
  moods text[] not null default '{}',
  tags text[] not null default '{}',
  notes text[] not null default '{}',
  preview_path text not null check (preview_path like id::text || '/%'),
  cover_path text check (cover_path like id::text || '/%'),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index catalog_published_idx on public.catalog_tracks(created_at desc) where published;
alter table public.catalog_tracks enable row level security;
revoke all on public.catalog_tracks from anon, authenticated;
grant select on public.catalog_tracks to anon, authenticated;
grant insert, update on public.catalog_tracks to authenticated;
grant all on public.catalog_tracks to service_role;
create policy "Public can read released tracks" on public.catalog_tracks
  for select to anon, authenticated using (published);
create policy "Admins can manage tracks" on public.catalog_tracks
  for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

grant insert, update on public.download_products to authenticated;
create policy "Admins can manage deliverables" on public.download_products
  for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('track-previews', 'track-previews', true, 52428800, array['audio/mpeg','audio/wav','audio/x-wav','audio/wave','audio/ogg','audio/mp4','audio/x-m4a','audio/flac','audio/x-flac']),
  ('track-covers', 'track-covers', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
update storage.buckets set file_size_limit = 52428800,
  allowed_mime_types = array['audio/mpeg','audio/wav','audio/x-wav','audio/wave','audio/ogg','audio/mp4','audio/x-m4a','audio/flac','audio/x-flac','application/zip','application/x-zip-compressed']
where id = 'purchased-beats';

create policy "Admins can upload track files" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('track-previews','track-covers','purchased-beats')
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );
create policy "Admins can read track files" on storage.objects
  for select to authenticated using (
    bucket_id in ('track-previews','track-covers','purchased-beats')
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );
create policy "Admins can remove unused track files" on storage.objects
  for delete to authenticated using (
    bucket_id in ('track-previews','track-covers','purchased-beats')
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
    and not exists (select 1 from public.catalog_tracks where preview_path = name or cover_path = name)
    and not exists (select 1 from public.download_products where storage_path = name)
  );

-- Save public metadata and its private deliverable atomically, with the caller's RLS.
create function public.save_catalog_track(p_track jsonb, p_download_path text default null, p_download_name text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  track_id uuid := (p_track->>'id')::uuid;
begin
  if not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise insufficient_privilege using message = 'Admin access required';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'track-previews' and name = p_track->>'preview_path') then
    raise exception 'Preview file not found';
  end if;
  if nullif(p_track->>'cover_path','') is not null and not exists (
    select 1 from storage.objects where bucket_id = 'track-covers' and name = p_track->>'cover_path'
  ) then raise exception 'Cover file not found'; end if;
  if p_download_path is not null then
    if p_download_path not like track_id::text || '/%' or not exists (
      select 1 from storage.objects where bucket_id = 'purchased-beats' and name = p_download_path
    ) then raise exception 'Private download file not found'; end if;
    insert into public.download_products(id, title, bpm, storage_path, download_name)
    values (track_id::text, p_track->>'title', (p_track->>'bpm')::integer, p_download_path, p_download_name)
    on conflict (id) do update set title = excluded.title, bpm = excluded.bpm,
      storage_path = excluded.storage_path, download_name = excluded.download_name;
  else
    update public.download_products set title = p_track->>'title', bpm = (p_track->>'bpm')::integer
      where id = track_id::text;
  end if;
  insert into public.catalog_tracks(id,kind,title,bpm,duration_seconds,genre,musical_key,description,moods,tags,notes,preview_path,cover_path,published)
  values (
    track_id, p_track->>'kind', p_track->>'title', (p_track->>'bpm')::integer,
    (p_track->>'duration_seconds')::integer, p_track->>'genre', p_track->>'musical_key', p_track->>'description',
    array(select jsonb_array_elements_text(p_track->'moods')),
    array(select jsonb_array_elements_text(p_track->'tags')),
    array(select jsonb_array_elements_text(p_track->'notes')),
    p_track->>'preview_path', nullif(p_track->>'cover_path',''), (p_track->>'published')::boolean
  ) on conflict (id) do update set kind = excluded.kind, title = excluded.title, bpm = excluded.bpm,
    duration_seconds = excluded.duration_seconds, genre = excluded.genre, musical_key = excluded.musical_key,
    description = excluded.description, moods = excluded.moods, tags = excluded.tags, notes = excluded.notes,
    preview_path = excluded.preview_path, cover_path = excluded.cover_path, published = excluded.published, updated_at = now();
end;
$$;
revoke all on function public.save_catalog_track(jsonb,text,text) from public, anon;
grant execute on function public.save_catalog_track(jsonb,text,text) to authenticated;
