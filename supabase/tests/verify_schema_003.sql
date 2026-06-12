-- Verificación canónica de esquema post-migración 003
-- Ejecutar manualmente en Supabase SQL Editor (proyecto remoto, rol postgres).
-- Tras un OK, definir VERIFY_SCHEMA_003_OK=true en .env.local y correr:
--   npm run verify:post-migration
--
-- Recomendado tras aplicar 003: Settings → API → Reload schema (PostgREST).

do $$
declare
  missing text[] := '{}';
  rpc text;
  rpcs text[] := array[
    'admin_set_profile_role',
    'admin_set_profile_verified',
    'admin_set_profile_active',
    'creator_withdraw_application',
    'business_shortlist_application',
    'business_reject_application',
    'business_accept_application'
  ];
begin
  -- Tabla de auditoría
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'platform_audit_logs'
  ) then
    missing := array_append(missing, 'tabla platform_audit_logs');
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'platform_audit_logs' and c.relrowsecurity
  ) then
    missing := array_append(missing, 'RLS en platform_audit_logs');
  end if;

  -- Columnas declaradas en creator_profiles
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'creator_profiles' and column_name = 'followers_declared'
  ) then
    missing := array_append(missing, 'creator_profiles.followers_declared');
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'creator_profiles' and column_name = 'engagement_declared'
  ) then
    missing := array_append(missing, 'creator_profiles.engagement_declared');
  end if;

  -- Restricciones CHECK relevantes
  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'creator_profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%followers_declared%'
  ) then
    missing := array_append(missing, 'CHECK followers_declared en creator_profiles');
  end if;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'creator_profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%engagement_declared%'
  ) then
    missing := array_append(missing, 'CHECK engagement_declared en creator_profiles');
  end if;

  -- Siete RPC de migración 003
  foreach rpc in array rpcs loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = rpc
    ) then
      missing := array_append(missing, 'RPC ' || rpc);
    end if;
  end loop;

  -- EXECUTE para authenticated en RPC expuestas a la app
  if not has_function_privilege('authenticated', 'public.creator_withdraw_application(uuid)', 'EXECUTE') then
    missing := array_append(missing, 'GRANT EXECUTE creator_withdraw_application → authenticated');
  end if;
  if not has_function_privilege('authenticated', 'public.business_shortlist_application(uuid)', 'EXECUTE') then
    missing := array_append(missing, 'GRANT EXECUTE business_shortlist_application → authenticated');
  end if;
  if not has_function_privilege('authenticated', 'public.business_reject_application(uuid)', 'EXECUTE') then
    missing := array_append(missing, 'GRANT EXECUTE business_reject_application → authenticated');
  end if;
  if not has_function_privilege('authenticated', 'public.business_accept_application(uuid)', 'EXECUTE') then
    missing := array_append(missing, 'GRANT EXECUTE business_accept_application → authenticated');
  end if;
  if not has_function_privilege('authenticated', 'public.admin_set_profile_role(uuid, public.account_role)', 'EXECUTE') then
    missing := array_append(missing, 'GRANT EXECUTE admin_set_profile_role → authenticated');
  end if;
  if not has_function_privilege('authenticated', 'public.admin_set_profile_verified(uuid, boolean)', 'EXECUTE') then
    missing := array_append(missing, 'GRANT EXECUTE admin_set_profile_verified → authenticated');
  end if;
  if not has_function_privilege('authenticated', 'public.admin_set_profile_active(uuid, boolean)', 'EXECUTE') then
    missing := array_append(missing, 'GRANT EXECUTE admin_set_profile_active → authenticated');
  end if;

  -- Triggers de seguridad
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'
      and t.tgname = 'guard_profiles_sensitive' and not t.tgisinternal
  ) then
    missing := array_append(missing, 'trigger guard_profiles_sensitive');
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'creator_profiles'
      and t.tgname = 'guard_creator_profiles_sensitive' and not t.tgisinternal
  ) then
    missing := array_append(missing, 'trigger guard_creator_profiles_sensitive');
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'business_profiles'
      and t.tgname = 'guard_business_profiles_sensitive' and not t.tgisinternal
  ) then
    missing := array_append(missing, 'trigger guard_business_profiles_sensitive');
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'applications'
      and t.tgname = 'guard_applications_fields' and not t.tgisinternal
  ) then
    missing := array_append(missing, 'trigger guard_applications_fields');
  end if;

  -- Políticas RLS nuevas / reforzadas
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'platform_audit_logs'
      and policyname = 'admins read audit logs'
  ) then
    missing := array_append(missing, 'política admins read audit logs');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversations'
      and policyname = 'no direct conversation insert'
  ) then
    missing := array_append(missing, 'política no direct conversation insert');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversation_members'
      and policyname = 'no direct membership insert'
  ) then
    missing := array_append(missing, 'política no direct membership insert');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reviews'
      and policyname = 'campaign parties review'
  ) then
    missing := array_append(missing, 'política campaign parties review');
  end if;

  -- Permisos por columna (profiles: sin UPDATE global en role/verified)
  if has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE global en profiles (esperado column-level)');
  end if;

  if array_length(missing, 1) > 0 then
    raise exception 'Migración 003 INCOMPLETA. Faltan: %', array_to_string(missing, ', ');
  else
    raise notice 'OK: esquema 003 verificado (tablas, columnas, RPC, triggers, políticas, EXECUTE, restricciones)';
  end if;
end $$;
