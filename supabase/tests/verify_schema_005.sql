-- Verificación canónica migración 005 (ejecutar tras 004 en sesión separada)

do $$
declare
  missing text[] := '{}';
  rpc text;
  pol record;
begin
  -- Funciones core
  foreach rpc in array array[
    'is_active_account', 'bootstrap_first_admin', 'business_publish_campaign',
    'business_accept_application', 'guard_conversation_member_fields',
    'guard_notification_fields', 'guard_review_fields', 'guard_application_insert',
    'guard_report_fields', 'guard_campaign_status_fields'
  ] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = rpc
    ) then
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

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'applications' and t.tgname = 'guard_applications_insert' and not t.tgisinternal
  ) then missing := array_append(missing, 'trigger guard_applications_insert'); end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'conversation_members' and t.tgname = 'guard_conversation_members_fields' and not t.tgisinternal
  ) then missing := array_append(missing, 'trigger guard_conversation_members_fields'); end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'notifications' and t.tgname = 'guard_notifications_fields' and not t.tgisinternal
  ) then missing := array_append(missing, 'trigger guard_notifications_fields'); end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'reviews' and t.tgname = 'guard_reviews_fields' and not t.tgisinternal
  ) then missing := array_append(missing, 'trigger guard_reviews_fields'); end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'reports' and t.tgname = 'guard_reports_fields' and not t.tgisinternal
  ) then missing := array_append(missing, 'trigger guard_reports_fields'); end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'campaigns' and t.tgname = 'guard_campaigns_status' and not t.tgisinternal
  ) then missing := array_append(missing, 'trigger guard_campaigns_status'); end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'admins update reports'
      and with_check is not null
  ) then
    missing := array_append(missing, 'política admins update reports sin WITH CHECK');
  end if;

  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'reviews_campaign_id_reviewer_profile_id_reviewed_profile_id_key'
  ) and not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reviews'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%campaign_id%reviewer_profile_id%reviewed_profile_id%'
  ) then
    missing := array_append(missing, 'unicidad reviews (campaign_id, reviewer_profile_id, reviewed_profile_id)');
  end if;

  -- Políticas clave
  foreach pol in
    select * from (values
      ('applications', 'application parties select'),
      ('applications', 'creator applies'),
      ('applications', 'application parties update'),
      ('favorites', 'own favorites select'),
      ('notifications', 'own notifications'),
      ('notifications', 'own notifications update'),
      ('reports', 'reporters create reports'),
      ('reports', 'admins read reports'),
      ('reports', 'admins update reports'),
      ('campaigns', 'business creates campaigns'),
      ('campaigns', 'business deletes draft campaigns'),
      ('conversation_members', 'members update own read state'),
      ('reviews', 'reviewer updates review')
    ) as t(tablename, policyname)
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = pol.tablename and policyname = pol.policyname
    ) then
      missing := array_append(missing, 'política ' || pol.policyname || ' en ' || pol.tablename);
    end if;
  end loop;

  -- Políticas con WITH CHECK obligatorias
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reviews' and policyname = 'reviewer updates review'
      and with_check is not null
  ) then
    missing := array_append(missing, 'política reviewer updates review sin WITH CHECK');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'own notifications update'
      and with_check is not null
  ) then
    missing := array_append(missing, 'política own notifications update sin WITH CHECK');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversation_members' and policyname = 'members update own read state'
      and with_check is not null
  ) then
    missing := array_append(missing, 'política members update own read state sin WITH CHECK');
  end if;

  -- Permisos columna: sin UPDATE global
  if has_table_privilege('authenticated', 'public.campaigns', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE global en campaigns');
  end if;
  if has_table_privilege('authenticated', 'public.applications', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE global en applications');
  end if;
  if has_table_privilege('authenticated', 'public.reports', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE global en reports');
  end if;
  if has_table_privilege('authenticated', 'public.conversation_members', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE global en conversation_members');
  end if;
  if has_table_privilege('authenticated', 'public.notifications', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE global en notifications');
  end if;
  if has_table_privilege('authenticated', 'public.reviews', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE global en reviews');
  end if;

  -- Permisos columna: grants esperados
  if not has_column_privilege('authenticated', 'public.reports', 'status', 'UPDATE') then
    missing := array_append(missing, 'GRANT UPDATE(status) reports → authenticated');
  end if;
  if not has_column_privilege('authenticated', 'public.reports', 'resolved_at', 'UPDATE') then
    missing := array_append(missing, 'GRANT UPDATE(resolved_at) reports → authenticated');
  end if;
  if has_column_privilege('authenticated', 'public.reports', 'reason', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE(reason) reports → authenticated');
  end if;

  if not has_column_privilege('authenticated', 'public.conversation_members', 'last_read_at', 'UPDATE') then
    missing := array_append(missing, 'GRANT UPDATE(last_read_at) conversation_members → authenticated');
  end if;
  if has_column_privilege('authenticated', 'public.conversation_members', 'conversation_id', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE(conversation_id) conversation_members → authenticated');
  end if;

  if not has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE') then
    missing := array_append(missing, 'GRANT UPDATE(read_at) notifications → authenticated');
  end if;
  if has_column_privilege('authenticated', 'public.notifications', 'title', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE(title) notifications → authenticated');
  end if;

  if not has_column_privilege('authenticated', 'public.reviews', 'rating', 'UPDATE') then
    missing := array_append(missing, 'GRANT UPDATE(rating) reviews → authenticated');
  end if;
  if not has_column_privilege('authenticated', 'public.reviews', 'comment', 'UPDATE') then
    missing := array_append(missing, 'GRANT UPDATE(comment) reviews → authenticated');
  end if;
  if has_column_privilege('authenticated', 'public.reviews', 'reviewed_profile_id', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE(reviewed_profile_id) reviews → authenticated');
  end if;

  if not has_column_privilege('authenticated', 'public.campaigns', 'title', 'UPDATE') then
    missing := array_append(missing, 'GRANT UPDATE(title) campaigns → authenticated');
  end if;
  if has_column_privilege('authenticated', 'public.campaigns', 'status', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE(status) campaigns → authenticated');
  end if;

  if not has_column_privilege('authenticated', 'public.applications', 'message', 'UPDATE') then
    missing := array_append(missing, 'GRANT UPDATE(message) applications → authenticated');
  end if;
  if has_column_privilege('authenticated', 'public.applications', 'status', 'UPDATE') then
    missing := array_append(missing, 'REVOKE UPDATE(status) applications → authenticated');
  end if;

  -- Reports grants base
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
