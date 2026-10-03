-- Legacy deliverables remain for manual purchases. New leases are separate products.
alter table public.download_products add column catalog_track_id uuid references public.catalog_tracks(id);
alter table public.download_products add column lease text check (lease in ('mp3','wav'));
create unique index download_product_lease_idx on public.download_products(catalog_track_id,lease);
alter table public.purchases drop constraint purchases_user_id_product_id_key;

create table public.checkout_orders (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
 amount integer not null check (amount > 0),
 currency text not null default 'cad' check (currency = 'cad'),
 stripe_session_id text unique,
 payment_intent_id text unique,
 status text not null default 'pending' check (status in ('pending','paid','refunded','expired','failed')),
 created_at timestamptz not null default now()
);
alter table public.checkout_orders enable row level security;
revoke all on public.checkout_orders from public, anon, authenticated;
grant select on public.checkout_orders to authenticated;
grant all on public.checkout_orders to service_role;
create policy "Customers can read their own orders" on public.checkout_orders for select to authenticated
 using (user_id = (select auth.uid()));
alter table public.purchases add column checkout_order_id uuid references public.checkout_orders(id);
create unique index purchases_order_product_idx on public.purchases(checkout_order_id,product_id);

-- Called only by the signed-webhook server after retrieving current Stripe state.
-- Locking serializes concurrent deliveries; refunded orders can never be re-granted.
create function public.complete_checkout_order(p_order_id uuid, p_session_id text, p_payment_intent text, p_amount integer, p_currency text, p_refund boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare o public.checkout_orders; item jsonb;
begin
 select * into o from public.checkout_orders where id = p_order_id for update;
 if not found then raise exception 'Unknown checkout order'; end if;
 if o.stripe_session_id is distinct from p_session_id or o.amount is distinct from p_amount or o.currency is distinct from p_currency
 then raise exception 'Payment does not match order'; end if;
 if p_payment_intent is null then raise exception 'Missing payment intent'; end if;
 if o.payment_intent_id is not null and o.payment_intent_id <> p_payment_intent then raise exception 'Payment intent mismatch'; end if;
 if p_refund then
   update public.checkout_orders set status = 'refunded', payment_intent_id = p_payment_intent where id = o.id;
   update public.purchases set status = 'refunded' where checkout_order_id = o.id;
   return;
 end if;
 if o.status in ('paid','refunded') then return; end if;
 for item in select * from jsonb_array_elements(o.items) loop
   insert into public.purchases(user_id,product_id,source,order_reference,checkout_order_id)
   values(o.user_id,item->>'product_id','stripe',p_session_id || ':' || (item->>'product_id'),o.id)
   on conflict (checkout_order_id,product_id) do nothing;
 end loop;
 update public.checkout_orders set status = 'paid', payment_intent_id = p_payment_intent where id = o.id;
end;
$$;
revoke all on function public.complete_checkout_order(uuid,text,text,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.complete_checkout_order(uuid,text,text,integer,text,boolean) to service_role;

create function public.save_track_lease(p_track_id uuid, p_lease text, p_path text, p_name text)
returns void language plpgsql security invoker set search_path = '' as $$
declare t public.catalog_tracks;
begin
 if not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
   raise insufficient_privilege using message = 'Admin access required'; end if;
 select * into t from public.catalog_tracks where id = p_track_id and kind = 'beats';
 if not found or p_lease not in ('mp3','wav') or p_path not like p_track_id::text || '/%'
   or right(lower(p_path),4) <> '.' || p_lease or p_name is null or length(p_name) not between 1 and 200
   or p_name ~ E'[/\\\\\r\n]' or not exists(select 1 from storage.objects where bucket_id = 'purchased-beats' and name = p_path)
 then raise exception 'Invalid lease deliverable'; end if;
 insert into public.download_products(id,title,bpm,storage_path,download_name,catalog_track_id,lease)
 values(p_track_id::text || ':' || p_lease,t.title,t.bpm,p_path,p_name,p_track_id,p_lease)
 on conflict (id) do update set title=excluded.title,bpm=excluded.bpm,storage_path=excluded.storage_path,download_name=excluded.download_name;
end;
$$;
revoke all on function public.save_track_lease(uuid,text,text,text) from public, anon;
grant execute on function public.save_track_lease(uuid,text,text,text) to authenticated;

-- Persist metadata and all newly uploaded formats in a single transaction.
create function public.save_catalog_track_with_leases(p_track jsonb,p_download_path text default null,p_download_name text default null,p_leases jsonb default '[]')
returns void language plpgsql security invoker set search_path = '' as $$
declare l jsonb;
begin
 perform public.save_catalog_track(p_track,p_download_path,p_download_name);
 for l in select * from jsonb_array_elements(p_leases) loop
   perform public.save_track_lease((p_track->>'id')::uuid,l->>'lease',l->>'path',l->>'name');
 end loop;
 update public.download_products set title=p_track->>'title',bpm=(p_track->>'bpm')::integer where catalog_track_id=(p_track->>'id')::uuid;
end;
$$;
revoke all on function public.save_catalog_track_with_leases(jsonb,text,text,jsonb) from public,anon;
grant execute on function public.save_catalog_track_with_leases(jsonb,text,text,jsonb) to authenticated;
create index checkout_orders_user_idx on public.checkout_orders(user_id,created_at desc);
