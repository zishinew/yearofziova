create table public.gift_codes (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(label) between 1 and 80),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.gift_codes enable row level security;
revoke all on public.gift_codes from public, anon, authenticated;
grant select, insert, update on public.gift_codes to service_role;

alter table public.checkout_orders add column gift_code_id uuid references public.gift_codes(id);
create index checkout_orders_gift_code_idx on public.checkout_orders(gift_code_id) where gift_code_id is not null;
alter table public.checkout_orders drop constraint checkout_orders_amount_check;
alter table public.checkout_orders add constraint checkout_orders_amount_check check (
  (gift_code_id is null and amount > 0) or
  (gift_code_id is not null and amount = 0 and status = 'paid' and stripe_session_id is null and payment_intent_id is null)
);

-- The server validates cart contents and file availability before calling this.
-- Lock against revocation and commit the order and download grants together.
create function public.redeem_gift_code(p_hash text, p_id uuid, p_user_id uuid, p_guest_email text, p_guest_hash text, p_items jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare gift_id uuid;
begin
  select id into gift_id from public.gift_codes
    where code_hash = p_hash and revoked_at is null for share;
  if gift_id is null then return false; end if;

  insert into public.checkout_orders (id, user_id, guest_email, guest_token_hash, items, amount, currency, status, gift_code_id)
    values (p_id, p_user_id, p_guest_email, p_guest_hash, p_items, 0, 'usd', 'paid', gift_id);
  insert into public.purchases (user_id, product_id, source, checkout_order_id)
    select p_user_id, item->>'product_id', 'gift', p_id from jsonb_array_elements(p_items) as item;
  return true;
end;
$$;
revoke all on function public.redeem_gift_code(text, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.redeem_gift_code(text, uuid, uuid, text, text, jsonb) to service_role;
