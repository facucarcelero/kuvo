-- Verificación canónica post-migración 004 (ejecutar en SQL Editor remoto)

do $$
declare
  missing text[] := '{}';
  rpc text;
  rpcs text[] := array[
    'business_publish_campaign',
    'business_pause_campaign',
    'business_reopen_campaign',
    'business_cancel_campaign',
    'business_complete_campaign'
  ];
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_active_account'
  ) then
    missing := array_append(missing, 'is_active_account()');
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'bootstrap_first_admin'
  ) then
    missing := array_append(missing, 'bootstrap_first_admin()');
  end if;

  if not has_function_privilege('authenticated', 'public.is_active_account()', 'EXECUTE') then
    missing := array_append(missing, 'GRANT EXECUTE is_active_account → authenticated');
  end if;

  if has_function_privilege('authenticated', 'public.write_audit_log(text, text, uuid, jsonb)', 'EXECUTE') then
    missing := array_append(missing, 'REVOKE EXECUTE write_audit_log → authenticated');
  end if;

  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'campaign_status' and e.enumlabel = 'in_progress'
  ) then
    missing := array_append(missing, 'campaign_status.in_progress');
  end if;

  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'applications_one_accepted_per_campaign_idx'
  ) then
    missing := array_append(missing, 'índice applications_one_accepted_per_campaign_idx');
  end if;

  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'conversations_one_per_campaign_idx'
  ) then
    missing := array_append(missing, 'índice conversations_one_per_campaign_idx');
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'reports'
  ) then
    missing := array_append(missing, 'tabla reports');
  end if;

  foreach rpc in array rpcs loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = rpc
    ) then
      missing := array_append(missing, 'RPC ' || rpc);
    end if;
  end loop;

  if not has_function_privilege('authenticated', 'public.business_accept_application(uuid)', 'EXECUTE') then
    missing := array_append(missing, 'GRANT EXECUTE business_accept_application');
  end if;

  if array_length(missing, 1) > 0 then
    raise exception 'Migración 004 INCOMPLETA. Faltan: %', array_to_string(missing, ', ');
  else
    raise notice 'OK: esquema 004 verificado';
  end if;
end $$;
