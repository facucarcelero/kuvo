-- Verificación migración 004 — enum in_progress
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'campaign_status' and e.enumlabel = 'in_progress'
  ) then
    raise exception 'Migración 004 INCOMPLETA: falta campaign_status.in_progress';
  else
    raise notice 'OK: migración 004 (in_progress)';
  end if;
end $$;
