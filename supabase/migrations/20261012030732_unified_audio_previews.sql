alter table public.catalog_tracks add column preview_start_seconds numeric not null default 0 check (preview_start_seconds >= 0 and preview_start_seconds < 86400);

create or replace function public.save_catalog_track_with_leases(p_track jsonb,p_download_path text default null,p_download_name text default null,p_leases jsonb default '[]')
returns void language plpgsql security invoker set search_path = '' as $$
declare l jsonb;
begin
 perform public.save_catalog_track(p_track,p_download_path,p_download_name);
 update public.catalog_tracks set preview_start_seconds=coalesce((p_track->>'preview_start_seconds')::numeric,0) where id=(p_track->>'id')::uuid;
 for l in select * from jsonb_array_elements(p_leases) loop
   perform public.save_track_lease((p_track->>'id')::uuid,l->>'lease',l->>'path',l->>'name');
 end loop;
 update public.download_products set title=p_track->>'title',bpm=(p_track->>'bpm')::integer where catalog_track_id=(p_track->>'id')::uuid;
end;
$$;

-- Keep the original admin-only RPC grants and Storage policies.
update storage.buckets set file_size_limit=null where id in ('track-previews','track-covers','purchased-beats');
