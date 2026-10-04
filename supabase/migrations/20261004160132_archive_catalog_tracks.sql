-- Removing a listing must not revoke previously purchased downloads.
alter table public.catalog_tracks add column deleted_at timestamptz;
alter table public.catalog_tracks add constraint deleted_tracks_not_published
  check (deleted_at is null or not published);
