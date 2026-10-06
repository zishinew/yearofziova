alter table public.checkout_orders alter column user_id drop not null;
alter table public.checkout_orders add column guest_email text;
alter table public.checkout_orders add column guest_token_hash text;
alter table public.checkout_orders add constraint guest_order_access check (
  user_id is not null or (guest_email is not null and guest_token_hash is not null and guest_token_hash ~ '^[a-f0-9]{64}$')
);
alter table public.purchases alter column user_id drop not null;
alter table public.purchases add constraint guest_purchase_order check (user_id is not null or checkout_order_id is not null);
create index checkout_orders_guest_email on public.checkout_orders (guest_email) where user_id is null;

-- Only the trusted server can claim purchases, and the email comes from Auth,
-- never from a caller-supplied address. Locking serializes with fulfillment.
create function public.claim_guest_orders(p_user_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare verified_email text; guest_order record;
begin
  select lower(email) into verified_email from auth.users
  where id = p_user_id and email_confirmed_at is not null;
  if verified_email is null then return; end if;
  for guest_order in select id from public.checkout_orders
    where user_id is null and guest_email = verified_email and status in ('paid', 'refunded')
    for update
  loop
    update public.checkout_orders set user_id = p_user_id where id = guest_order.id;
    update public.purchases set user_id = p_user_id where checkout_order_id = guest_order.id;
  end loop;
end;
$$;
revoke all on function public.claim_guest_orders(uuid) from public, anon, authenticated;
grant execute on function public.claim_guest_orders(uuid) to service_role;
