-- Full deliverables are private. Only verified purchases grant access.
create table public.download_products (
  id text primary key,
  title text not null,
  bpm integer check (bpm > 0),
  storage_path text not null unique check (length(storage_path) > 0),
  download_name text not null check (length(download_name) > 0),
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.download_products(id),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  source text not null default 'manual',
  order_reference text unique,
  purchased_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index purchases_product_owner_idx on public.purchases(product_id, user_id) where status = 'paid';

alter table public.download_products enable row level security;
alter table public.purchases enable row level security;

revoke all on public.download_products, public.purchases from anon, authenticated;
grant select on public.download_products, public.purchases to authenticated;
grant all on public.download_products, public.purchases to service_role;

create policy "Customers can see their own purchases"
  on public.purchases for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Customers can see products they purchased"
  on public.download_products for select to authenticated
  using (exists (
    select 1 from public.purchases p
    where p.product_id = download_products.id
      and p.user_id = (select auth.uid()) and p.status = 'paid'
  ));

insert into storage.buckets (id, name, public)
values ('purchased-beats', 'purchased-beats', false)
on conflict (id) do update set public = false;

create policy "Customers can download purchased deliverables"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'purchased-beats'
    and exists (
      select 1 from public.download_products d
      join public.purchases p on p.product_id = d.id
      where d.storage_path = storage.objects.name
        and p.user_id = (select auth.uid()) and p.status = 'paid'
    )
  );

-- Customers have no INSERT, UPDATE, DELETE, or upload policies.
-- Grant purchases only from a trusted payment webhook or the owner dashboard.
