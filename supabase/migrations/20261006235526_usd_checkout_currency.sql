-- Existing CAD orders retain their original currency for receipts and refunds.
alter table public.checkout_orders drop constraint checkout_orders_currency_check;
alter table public.checkout_orders add constraint checkout_orders_currency_check check (currency in ('cad', 'usd'));
alter table public.checkout_orders alter column currency set default 'usd';
