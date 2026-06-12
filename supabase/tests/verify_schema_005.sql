-- Verificación canónica migración 005 (ejecutar tras 004 en sesión separada)

do $$
declare
  missing text[] := '{}';
  rpc text;
begin
  -- Funciones core
  foreach rpc in array array['is_active_account', 'bootstrap_first_admin', 'business_publish_campaign', 'business_accept_application'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = rpc) then
      missing := array_append(missing, 'función ' || rpc);
    end if;
  end loop;

  if has_function_privilege('authenticated', 'public.bootstrap_first_admin(text)', 'EXECUTE') then
    missing := array_append(missing, 'REVOKE EXECUTE bootstrap_first_admin → authenticated/anon');
  end if;
  if has_function_privilege('anon', 'public.bootstrap_first_admin(text)', 'EXECUTE') then
    missing := array_append(missing, 'REVOKE EXECUTE bootstrap_first_admin → anon');
  end if;

  if has_function_privilege('authenticated', 'public.write_audit_log(text, text, uuid, jsonb)', 'EXECUTE') then
    missing := array_append(missing, 'REVOKE EXECUTE write_audit_log → authenticated');
  end if;
  if has_function_privilege('authenticated', 'public._notify_account(uuid, text, text, text)', 'EXECUTE') then
    missing := array_append(missing, 'REVOKE EXECUTE _notify_account → authenticated');
  end if;

  if not has_function_privilege('authenticated', 'public.is_active_account()', 'EXECUTE') then
    missing := array_append(missing, 'GRANT EXECUTE is_active_account → authenticated');
  end if;

  -- Índices unicidad
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'applications_one_accepted_per_campaign_idx') then
    missing := array_append(missing, 'índice applications_one_accepted_per_campaign_idx');
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'conversations_one_per_campaign_idx') then
    missing := array_append(missing, 'índice conversations_one_per_campaign_idx');
  end if;

  -- Triggers
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles' and t.tgname = 'guard_profiles_sensitive' and not t.tgisinternal
  ) then missing := array_append(missing, 'trigger guard_profiles_sensitive'); end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'applications' and t.tgname = 'guard_applications_fields' and not t.tgisinternal
  ) then missing := array_append(missing, 'trigger guard_applications_fields'); end if;

  -- Políticas clave
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applications' and policyname = 'application parties select') then
    missing := array_append(missing, 'política application parties select');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'favorites' and policyname = 'own favorites select') then
    missing := array_append(missing, 'política own favorites select');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'own notifications') then
    missing := array_append(missing, 'política own notifications');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports' and policyname = 'reporters create reports') then
    missing := array_append(missing, 'política reporters create reports');
  end if;

  -- Permisos columna campaigns/applications
  if has_table_privilege('authenticated', 'public.campaigns', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE global en campaigns (esperado column-level sin status)');
  end if;
  if has_table_privilege('authenticated', 'public.applications', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE global en applications (esperado column-level sin status)');
  end if;

  -- Reports grants
  if not has_table_privilege('authenticated', 'public.reports', 'INSERT') then
    missing := array_append(missing, 'GRANT INSERT reports → authenticated');
  end if;
  if has_table_privilege('anon', 'public.reports', 'INSERT') then
    missing := array_append(missing, 'REVOKE INSERT reports → anon');
  end if;

  -- Realtime
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    missing := array_append(missing, 'Realtime: messages');
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    missing := array_append(missing, 'Realtime: notifications');
  end if;

  if array_length(missing, 1) > 0 then
    raise exception 'Migración 005 INCOMPLETA. Faltan: %', array_to_string(missing, ', ');
  else
    raise notice 'OK: migración 005 verificada';
  end if;
end $$;
