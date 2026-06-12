-- KUVO 003 — Endurecimiento de seguridad (P0)
-- Ejecutar en bases existentes que ya tengan 001_schema.sql (+ opcional 002_seed.sql)

-- ---------------------------------------------------------------------------
-- Auditoría administrativa
-- ---------------------------------------------------------------------------
create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 2 and 120),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_created_idx
  on public.platform_audit_logs(created_at desc);

alter table public.platform_audit_logs enable row level security;

drop policy if exists "admins read audit logs" on public.platform_audit_logs;
create policy "admins read audit logs"
  on public.platform_audit_logs for select
  using (public.is_admin());

revoke all on public.platform_audit_logs from anon, authenticated;
grant select on public.platform_audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Usernames case-insensitive
-- ---------------------------------------------------------------------------
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

-- ---------------------------------------------------------------------------
-- Métricas declaradas vs calculadas (creador)
-- ---------------------------------------------------------------------------
alter table public.creator_profiles
  add column if not exists followers_declared integer not null default 0
    check (followers_declared >= 0);

alter table public.creator_profiles
  add column if not exists engagement_declared numeric(6,2) not null default 0
    check (engagement_declared >= 0 and engagement_declared <= 100);

update public.creator_profiles
set
  followers_declared = coalesce(nullif(followers_declared, 0), followers),
  engagement_declared = case when engagement_declared = 0 then engagement else engagement_declared end
where followers_declared = 0 or engagement_declared = 0;

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.platform_audit_logs(actor_profile_id, action, entity_type, entity_id, metadata)
  values (public.current_profile_id(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.write_audit_log(text, text, uuid, jsonb) from public;
grant execute on function public.write_audit_log(text, text, uuid, jsonb) to authenticated;

create or replace function public.guard_profile_sensitive_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'No tenés permiso para modificar el rol.';
    end if;
    if new.verified is distinct from old.verified then
      raise exception 'No tenés permiso para modificar la verificación.';
    end if;
    if new.active is distinct from old.active then
      raise exception 'No tenés permiso para modificar el estado activo.';
    end if;
    if new.account_id is distinct from old.account_id then
      raise exception 'No tenés permiso para modificar account_id.';
    end if;
    if new.id is distinct from old.id then
      raise exception 'No tenés permiso para modificar id.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profiles_sensitive on public.profiles;
create trigger guard_profiles_sensitive
  before update on public.profiles
  for each row execute function public.guard_profile_sensitive_fields();

create or replace function public.guard_creator_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.score is distinct from old.score then
      raise exception 'El KUVO Score solo puede modificarse desde la plataforma.';
    end if;
    if new.profile_id is distinct from old.profile_id then
      raise exception 'No autorizado.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_creator_profiles_sensitive on public.creator_profiles;
create trigger guard_creator_profiles_sensitive
  before update on public.creator_profiles
  for each row execute function public.guard_creator_profile_fields();

create or replace function public.guard_business_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.verified is distinct from old.verified then
      raise exception 'La verificación del negocio solo puede asignarla un administrador.';
    end if;
    if new.profile_id is distinct from old.profile_id then
      raise exception 'No autorizado.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_business_profiles_sensitive on public.business_profiles;
create trigger guard_business_profiles_sensitive
  before update on public.business_profiles
  for each row execute function public.guard_business_profile_fields();

create or replace function public.guard_application_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_creator boolean;
  v_is_business boolean;
begin
  if public.is_admin() then
    return new;
  end if;

  v_is_creator := exists(
    select 1 from public.creator_profiles c
    where c.id = old.creator_id and c.profile_id = public.current_profile_id()
  );
  v_is_business := exists(
    select 1 from public.campaigns ca
    join public.business_profiles b on b.id = ca.business_id
    where ca.id = old.campaign_id and b.profile_id = public.current_profile_id()
  );

  if new.campaign_id is distinct from old.campaign_id
     or new.creator_id is distinct from old.creator_id then
    raise exception 'No podés modificar la campaña o el creador de una postulación.';
  end if;

  if v_is_creator then
    if not v_is_business then
      if old.status not in ('pending') then
        raise exception 'Solo podés editar postulaciones pendientes.';
      end if;
      if new.status is distinct from old.status and new.status not in ('pending', 'withdrawn') then
        raise exception 'Estado de postulación no permitido para creador.';
      end if;
      if new.message is distinct from old.message
         or new.proposed_price is distinct from old.proposed_price then
        if new.status not in ('pending', 'withdrawn') then
          raise exception 'No podés editar una postulación en este estado.';
        end if;
      end if;
    end if;
  elsif v_is_business then
    if new.message is distinct from old.message
       or new.proposed_price is distinct from old.proposed_price then
      raise exception 'No podés modificar la propuesta del creador.';
    end if;
    if new.status is distinct from old.status then
      if not (
        (old.status = 'pending' and new.status in ('shortlisted', 'accepted', 'rejected', 'withdrawn'))
        or (old.status = 'shortlisted' and new.status in ('accepted', 'rejected'))
      ) then
        raise exception 'Transición de estado no permitida.';
      end if;
    end if;
  else
    raise exception 'No autorizado.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_applications_fields on public.applications;
create trigger guard_applications_fields
  before update on public.applications
  for each row execute function public.guard_application_fields();

-- ---------------------------------------------------------------------------
-- Permisos por columna
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (full_name, username, city, avatar_url, bio)
  on public.profiles to authenticated;

revoke update on public.creator_profiles from authenticated;
grant update (
  categories, instagram, tiktok, youtube,
  followers_declared, engagement_declared,
  starting_price, availability, portfolio, experience
) on public.creator_profiles to authenticated;

revoke update on public.business_profiles from authenticated;
grant update (business_name, industry, website, location, logo_url)
  on public.business_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Endurecer funciones existentes
-- ---------------------------------------------------------------------------
revoke all on function public.current_profile_id() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas: conversaciones controladas
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated create conversations" on public.conversations;
drop policy if exists "members add membership" on public.conversation_members;

create policy "no direct conversation insert"
  on public.conversations for insert
  to authenticated
  with check (public.is_admin());

create policy "no direct membership insert"
  on public.conversation_members for insert
  to authenticated
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reseñas: contraparte obligatoria
-- ---------------------------------------------------------------------------
drop policy if exists "campaign parties review" on public.reviews;
create policy "campaign parties review"
  on public.reviews for insert
  with check (
    reviewer_profile_id = public.current_profile_id()
    and exists(
      select 1 from public.campaigns c
      where c.id = campaign_id and c.status = 'completed'
    )
    and (
      exists(
        select 1
        from public.applications a
        join public.creator_profiles cp on cp.id = a.creator_id
        join public.campaigns ca on ca.id = a.campaign_id
        join public.business_profiles bp on bp.id = ca.business_id
        where a.campaign_id = reviews.campaign_id
          and a.status = 'accepted'
          and cp.profile_id = public.current_profile_id()
          and bp.profile_id = reviewed_profile_id
      )
      or exists(
        select 1
        from public.applications a
        join public.creator_profiles cp on cp.id = a.creator_id
        join public.campaigns ca on ca.id = a.campaign_id
        join public.business_profiles bp on bp.id = ca.business_id
        where a.campaign_id = reviews.campaign_id
          and a.status = 'accepted'
          and bp.profile_id = public.current_profile_id()
          and cp.profile_id = reviewed_profile_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- RPC administrativas
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_profile_role(
  p_profile_id uuid,
  p_role public.account_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if p_role = 'admin' and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  update public.profiles set role = p_role where id = p_profile_id;
  perform public.write_audit_log(
    'admin_set_profile_role',
    'profiles',
    p_profile_id,
    jsonb_build_object('role', p_role)
  );
end;
$$;

create or replace function public.admin_set_profile_verified(
  p_profile_id uuid,
  p_verified boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  update public.profiles set verified = p_verified where id = p_profile_id;
  perform public.write_audit_log(
    'admin_set_profile_verified',
    'profiles',
    p_profile_id,
    jsonb_build_object('verified', p_verified)
  );
end;
$$;

create or replace function public.admin_set_profile_active(
  p_profile_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  update public.profiles set active = p_active where id = p_profile_id;
  perform public.write_audit_log(
    'admin_set_profile_active',
    'profiles',
    p_profile_id,
    jsonb_build_object('active', p_active)
  );
end;
$$;

revoke all on function public.admin_set_profile_role(uuid, public.account_role) from public;
revoke all on function public.admin_set_profile_verified(uuid, boolean) from public;
revoke all on function public.admin_set_profile_active(uuid, boolean) from public;
grant execute on function public.admin_set_profile_role(uuid, public.account_role) to authenticated;
grant execute on function public.admin_set_profile_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_set_profile_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC postulaciones
-- ---------------------------------------------------------------------------
create or replace function public._notify_account(
  p_account_id uuid,
  p_title text,
  p_body text,
  p_action_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_account_id is null then return; end if;
  insert into public.notifications(account_id, title, body, action_url)
  values (p_account_id, p_title, p_body, p_action_url);
end;
$$;

revoke all on function public._notify_account(uuid, text, text, text) from public;

create or replace function public.creator_withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Postulación no encontrada.'; end if;

  if not exists(
    select 1 from public.creator_profiles c
    where c.id = v_app.creator_id and c.profile_id = public.current_profile_id()
  ) then
    raise exception 'No autorizado.';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'Solo podés retirar postulaciones pendientes.';
  end if;

  update public.applications
  set status = 'withdrawn', updated_at = now()
  where id = p_application_id;
end;
$$;

create or replace function public.business_shortlist_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Postulación no encontrada.'; end if;

  if not exists(
    select 1 from public.campaigns ca
    join public.business_profiles b on b.id = ca.business_id
    where ca.id = v_app.campaign_id and b.profile_id = public.current_profile_id()
  ) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'Solo podés preseleccionar postulaciones pendientes.';
  end if;

  update public.applications set status = 'shortlisted', updated_at = now()
  where id = p_application_id;
end;
$$;

create or replace function public.business_reject_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Postulación no encontrada.'; end if;

  if not exists(
    select 1 from public.campaigns ca
    join public.business_profiles b on b.id = ca.business_id
    where ca.id = v_app.campaign_id and b.profile_id = public.current_profile_id()
  ) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  if v_app.status not in ('pending', 'shortlisted') then
    raise exception 'Estado inválido para rechazar.';
  end if;

  update public.applications set status = 'rejected', updated_at = now()
  where id = p_application_id;
end;
$$;

create or replace function public.business_accept_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
  v_business_profile_id uuid;
  v_creator_profile_id uuid;
  v_business_account_id uuid;
  v_creator_account_id uuid;
  v_conversation_id uuid;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Postulación no encontrada.'; end if;

  select b.profile_id, p.account_id
    into v_business_profile_id, v_business_account_id
  from public.campaigns ca
  join public.business_profiles b on b.id = ca.business_id
  join public.profiles p on p.id = b.profile_id
  where ca.id = v_app.campaign_id;

  if v_business_profile_id is distinct from public.current_profile_id() and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  if v_app.status not in ('pending', 'shortlisted') then
    raise exception 'Estado inválido para aceptar.';
  end if;

  update public.applications
  set status = 'accepted', updated_at = now()
  where id = p_application_id;

  update public.applications
  set status = 'rejected', updated_at = now()
  where campaign_id = v_app.campaign_id
    and id <> p_application_id
    and status in ('pending', 'shortlisted');

  select cp.profile_id, p.account_id
    into v_creator_profile_id, v_creator_account_id
  from public.creator_profiles cp
  join public.profiles p on p.id = cp.profile_id
  where cp.id = v_app.creator_id;

  insert into public.conversations(campaign_id)
  values (v_app.campaign_id)
  returning id into v_conversation_id;

  insert into public.conversation_members(conversation_id, profile_id)
  values
    (v_conversation_id, v_business_profile_id),
    (v_conversation_id, v_creator_profile_id);

  perform public._notify_account(
    v_creator_account_id,
    'Postulación aceptada',
    'Tu propuesta fue aceptada. Ya podés conversar con el negocio.',
    '/panel'
  );
  perform public._notify_account(
    v_business_account_id,
    'Colaboración confirmada',
    'Aceptaste una postulación. Se abrió una conversación.',
    '/panel'
  );

  perform public.write_audit_log(
    'business_accept_application',
    'applications',
    p_application_id,
    jsonb_build_object('conversation_id', v_conversation_id)
  );

  return v_conversation_id;
end;
$$;

revoke all on function public.creator_withdraw_application(uuid) from public;
revoke all on function public.business_shortlist_application(uuid) from public;
revoke all on function public.business_reject_application(uuid) from public;
revoke all on function public.business_accept_application(uuid) from public;
grant execute on function public.creator_withdraw_application(uuid) to authenticated;
grant execute on function public.business_shortlist_application(uuid) to authenticated;
grant execute on function public.business_reject_application(uuid) to authenticated;
grant execute on function public.business_accept_application(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: quitar SVG público sin sanitización
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'avatars';

update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4']
where id = 'portfolio';
