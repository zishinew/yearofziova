-- Supabase's internal event-trigger function is not a customer RPC.
-- Some project templates expose it by default; other templates omit it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
