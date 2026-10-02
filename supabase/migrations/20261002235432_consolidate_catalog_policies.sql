drop policy "Public can read released tracks" on public.catalog_tracks;
drop policy "Admins can manage tracks" on public.catalog_tracks;
create policy "Public can read released tracks" on public.catalog_tracks
  for select to anon using (published);
create policy "Members can read published tracks or administer drafts" on public.catalog_tracks
  for select to authenticated using (
    published or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );
create policy "Admins can insert tracks" on public.catalog_tracks
  for insert to authenticated with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admins can update tracks" on public.catalog_tracks
  for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

drop policy "Customers can see products they purchased" on public.download_products;
drop policy "Admins can manage deliverables" on public.download_products;
create policy "Members can read owned deliverables or administer them" on public.download_products
  for select to authenticated using (
    exists (select 1 from public.admin_users where user_id = (select auth.uid()))
    or exists (select 1 from public.purchases p where p.product_id = download_products.id
      and p.user_id = (select auth.uid()) and p.status = 'paid')
  );
create policy "Admins can insert deliverables" on public.download_products
  for insert to authenticated with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admins can update deliverables" on public.download_products
  for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
