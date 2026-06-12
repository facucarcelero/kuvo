-- KUVO 005 — Endurecimiento de producción (V1)
-- Requisitos: 001 + 003 aplicados, y 004_add_campaign_in_progress.sql ejecutado en sesión previa.

-- ---------------------------------------------------------------------------
-- Flags transaccionales internos (solo funciones SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_sensitive_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('kuvo.bootstrap_admin', true) = 'on' then
    return new;
  end if;
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

create or replace function public.guard_application_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_creator boolean;
begin
  if public.is_admin() then
    return new;
  end if;

  if current_setting('kuvo.allow_application_status', true) <> 'on' then
    if new.status is distinct from old.status then
      raise exception 'Los cambios de estado solo pueden hacerse mediante RPC.';
    end if;
  end if;

  v_is_creator := exists(
    select 1 from public.creator_profiles c
    where c.id = old.creator_id and c.profile_id = public.current_profile_id()
  );

  if new.campaign_id is distinct from old.campaign_id
     or new.creator_id is distinct from old.creator_id then
    raise exception 'No podés modificar la campaña o el creador de una postulación.';
  end if;

  if v_is_creator then
    if old.status <> 'pending' then
      raise exception 'Solo podés editar postulaciones pendientes.';
    end if;
    if new.message is distinct from old.message
       or new.proposed_price is distinct from old.proposed_price then
      null;
    end if;
  else
    if new.message is distinct from old.message
       or new.proposed_price is distinct from old.proposed_price then
      raise exception 'No podés modificar la propuesta del creador.';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1.1 Cuenta activa
-- ---------------------------------------------------------------------------
create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where account_id = auth.uid() and active = true
  );
$$;

revoke all on function public.is_active_account() from public;
grant execute on function public.is_active_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 1.2 Bootstrap del primer administrador (solo SQL Editor / postgres)
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_first_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile_id uuid;
begin
  if exists (
    select 1 from public.profiles where role = 'admin' and active = true
  ) then
    raise exception 'Ya existe un administrador activo.';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  join auth.users u on u.id = p.account_id
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_profile_id is null then
    raise exception 'No se encontró perfil para el correo indicado.';
  end if;

  perform set_config('kuvo.bootstrap_admin', 'on', true);

  update public.profiles
  set role = 'admin', verified = true, updated_at = now()
  where id = v_profile_id;

  perform set_config('kuvo.bootstrap_admin', 'off', true);

  insert into public.platform_audit_logs(actor_profile_id, action, entity_type, entity_id, metadata)
  values (
    v_profile_id,
    'bootstrap_first_admin',
    'profiles',
    v_profile_id,
    jsonb_build_object('email', lower(trim(p_email)))
  );
end;
$$;

revoke all on function public.bootstrap_first_admin(text) from public;
revoke all on function public.bootstrap_first_admin(text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1.3 Auditoría protegida
-- ---------------------------------------------------------------------------
revoke all on function public.write_audit_log(text, text, uuid, jsonb) from authenticated, anon, public;
revoke all on function public._notify_account(uuid, text, text, text) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- 1.4 Unicidad aceptación / conversación
-- ---------------------------------------------------------------------------
create unique index if not exists applications_one_accepted_per_campaign_idx
  on public.applications (campaign_id)
  where status = 'accepted';

create unique index if not exists conversations_one_per_campaign_idx
  on public.conversations (campaign_id)
  where campaign_id is not null;

-- ---------------------------------------------------------------------------
-- Permisos por columna: campañas y postulaciones
-- ---------------------------------------------------------------------------
revoke update on public.campaigns from authenticated;
grant update (title, description, category, city, budget_min, budget_max, deliverables, deadline)
  on public.campaigns to authenticated;

revoke update on public.applications from authenticated;
grant update (message, proposed_price)
  on public.applications to authenticated;

-- ---------------------------------------------------------------------------
-- Tabla reports (moderación)
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'campaign', 'message', 'review')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 5 and 500),
  details text check (char_length(coalesce(details, '')) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists reports_status_created_idx on public.reports(status, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "reporters create reports" on public.reports;
create policy "reporters create reports"
  on public.reports for insert
  with check (
    reporter_profile_id = public.current_profile_id()
    and public.is_active_account()
  );

drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports"
  on public.reports for select
  using (public.is_admin());

drop policy if exists "admins update reports" on public.reports;
create policy "admins update reports"
  on public.reports for update
  using (public.is_admin());

revoke all on public.reports from anon;
grant select, insert on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Helper: transiciones de campaña
-- ---------------------------------------------------------------------------
create or replace function public._assert_campaign_transition(
  p_from public.campaign_status,
  p_to public.campaign_status
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if (p_from, p_to) not in (
    values
      ('draft'::public.campaign_status, 'open'::public.campaign_status),
      ('draft'::public.campaign_status, 'cancelled'::public.campaign_status),
      ('open'::public.campaign_status, 'paused'::public.campaign_status),
      ('open'::public.campaign_status, 'in_progress'::public.campaign_status),
      ('open'::public.campaign_status, 'cancelled'::public.campaign_status),
      ('paused'::public.campaign_status, 'open'::public.campaign_status),
      ('paused'::public.campaign_status, 'cancelled'::public.campaign_status),
      ('in_progress'::public.campaign_status, 'completed'::public.campaign_status),
      ('in_progress'::public.campaign_status, 'cancelled'::public.campaign_status)
  ) then
    raise exception 'Transición de campaña no permitida: % → %', p_from, p_to;
  end if;
end;
$$;

revoke all on function public._assert_campaign_transition(public.campaign_status, public.campaign_status) from public;

create or replace function public._set_campaign_status(p_campaign_id uuid, p_to public.campaign_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns%rowtype;
begin
  select * into v_campaign from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'Campaña no encontrada.'; end if;
  perform public._assert_campaign_transition(v_campaign.status, p_to);
  update public.campaigns set status = p_to, updated_at = now() where id = p_campaign_id;
end;
$$;

revoke all on function public._set_campaign_status(uuid, public.campaign_status) from public;

-- ---------------------------------------------------------------------------
-- RPC campañas
-- ---------------------------------------------------------------------------
create or replace function public.business_publish_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns%rowtype;
begin
  if not public.is_active_account() and not public.is_admin() then
    raise exception 'Cuenta bloqueada o sin perfil.';
  end if;
  select * into v_campaign from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'Campaña no encontrada.'; end if;
  if not exists(
    select 1 from public.business_profiles b
    join public.profiles p on p.id = b.profile_id
    where b.id = v_campaign.business_id and b.profile_id = public.current_profile_id() and p.active = true
  ) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  perform public._set_campaign_status(p_campaign_id, 'open');
  perform public.write_audit_log('business_publish_campaign', 'campaigns', p_campaign_id, '{}'::jsonb);
end;
$$;

create or replace function public.business_pause_campaign(p_campaign_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_account() and not public.is_admin() then raise exception 'Cuenta bloqueada o sin perfil.'; end if;
  if not exists(select 1 from public.campaigns ca join public.business_profiles b on b.id = ca.business_id where ca.id = p_campaign_id and b.profile_id = public.current_profile_id()) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  perform public._set_campaign_status(p_campaign_id, 'paused');
end; $$;

create or replace function public.business_reopen_campaign(p_campaign_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_account() and not public.is_admin() then raise exception 'Cuenta bloqueada o sin perfil.'; end if;
  if not exists(select 1 from public.campaigns ca join public.business_profiles b on b.id = ca.business_id where ca.id = p_campaign_id and b.profile_id = public.current_profile_id()) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  perform public._set_campaign_status(p_campaign_id, 'open');
end; $$;

create or replace function public.business_cancel_campaign(p_campaign_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_account() and not public.is_admin() then raise exception 'Cuenta bloqueada o sin perfil.'; end if;
  if not exists(select 1 from public.campaigns ca join public.business_profiles b on b.id = ca.business_id where ca.id = p_campaign_id and b.profile_id = public.current_profile_id()) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  perform public._set_campaign_status(p_campaign_id, 'cancelled');
end; $$;

create or replace function public.business_complete_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_account() and not public.is_admin() then raise exception 'Cuenta bloqueada o sin perfil.'; end if;
  if not exists(select 1 from public.campaigns ca join public.business_profiles b on b.id = ca.business_id where ca.id = p_campaign_id and b.profile_id = public.current_profile_id()) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  perform public._set_campaign_status(p_campaign_id, 'completed');
  perform public.write_audit_log('business_complete_campaign', 'campaigns', p_campaign_id, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC postulaciones
-- ---------------------------------------------------------------------------
create or replace function public._set_application_status(p_application_id uuid, p_status public.application_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('kuvo.allow_application_status', 'on', true);
  update public.applications set status = p_status, updated_at = now() where id = p_application_id;
  perform set_config('kuvo.allow_application_status', 'off', true);
end;
$$;

revoke all on function public._set_application_status(uuid, public.application_status) from public;

create or replace function public.creator_withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_app public.applications%rowtype;
begin
  if not public.is_active_account() then raise exception 'Cuenta bloqueada o sin perfil.'; end if;
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Postulación no encontrada.'; end if;
  if not exists(select 1 from public.creator_profiles c join public.profiles p on p.id = c.profile_id where c.id = v_app.creator_id and c.profile_id = public.current_profile_id() and p.active = true) then
    raise exception 'No autorizado.';
  end if;
  if v_app.status <> 'pending' then raise exception 'Solo podés retirar postulaciones pendientes.'; end if;
  perform public._set_application_status(p_application_id, 'withdrawn');
end;
$$;

create or replace function public.business_shortlist_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_app public.applications%rowtype; v_campaign public.campaigns%rowtype;
begin
  if not public.is_active_account() and not public.is_admin() then raise exception 'Cuenta bloqueada o sin perfil.'; end if;
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Postulación no encontrada.'; end if;
  select * into v_campaign from public.campaigns where id = v_app.campaign_id for update;
  if v_campaign.status <> 'open' then raise exception 'La campaña no acepta cambios de postulación.'; end if;
  if not exists(select 1 from public.business_profiles b join public.profiles p on p.id = b.profile_id where b.id = v_campaign.business_id and b.profile_id = public.current_profile_id() and p.active = true) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if v_app.status <> 'pending' then raise exception 'Solo podés preseleccionar postulaciones pendientes.'; end if;
  perform public._set_application_status(p_application_id, 'shortlisted');
end;
$$;

create or replace function public.business_reject_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_app public.applications%rowtype;
begin
  if not public.is_active_account() and not public.is_admin() then raise exception 'Cuenta bloqueada o sin perfil.'; end if;
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Postulación no encontrada.'; end if;
  if not exists(select 1 from public.campaigns ca join public.business_profiles b on b.id = ca.business_id join public.profiles p on p.id = b.profile_id where ca.id = v_app.campaign_id and b.profile_id = public.current_profile_id() and p.active = true) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if v_app.status not in ('pending', 'shortlisted') then raise exception 'Estado inválido para rechazar.'; end if;
  perform public._set_application_status(p_application_id, 'rejected');
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
  v_campaign public.campaigns%rowtype;
  v_business_profile_id uuid;
  v_creator_profile_id uuid;
  v_business_account_id uuid;
  v_creator_account_id uuid;
  v_conversation_id uuid;
  v_other_accepted uuid;
begin
  if not public.is_active_account() and not public.is_admin() then
    raise exception 'Cuenta bloqueada o sin perfil.';
  end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Postulación no encontrada.'; end if;

  select * into v_campaign from public.campaigns where id = v_app.campaign_id for update;
  if not found then raise exception 'Campaña no encontrada.'; end if;

  select b.profile_id, p.account_id
    into v_business_profile_id, v_business_account_id
  from public.business_profiles b
  join public.profiles p on p.id = b.profile_id
  where b.id = v_campaign.business_id;

  if v_business_profile_id is distinct from public.current_profile_id() and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  if not exists(select 1 from public.profiles where id = v_business_profile_id and active = true) then
    raise exception 'El negocio no está activo.';
  end if;

  select cp.profile_id, p.account_id
    into v_creator_profile_id, v_creator_account_id
  from public.creator_profiles cp
  join public.profiles p on p.id = cp.profile_id
  where cp.id = v_app.creator_id;

  if not exists(select 1 from public.profiles where id = v_creator_profile_id and active = true) then
    raise exception 'El creador no está activo.';
  end if;

  select id into v_conversation_id from public.conversations where campaign_id = v_app.campaign_id limit 1;

  if v_app.status = 'accepted' then
    if v_conversation_id is null then
      raise exception 'Postulación aceptada sin conversación asociada.';
    end if;
    return v_conversation_id;
  end if;

  select id into v_other_accepted
  from public.applications
  where campaign_id = v_app.campaign_id and status = 'accepted' and id <> p_application_id
  limit 1;

  if v_other_accepted is not null then
    raise exception 'Esta campaña ya tiene un creador aceptado.';
  end if;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  if v_campaign.status <> 'open' then
    raise exception 'La campaña no está abierta para aceptar postulaciones.';
  end if;

  if v_app.status not in ('pending', 'shortlisted') then
    raise exception 'Estado inválido para aceptar.';
  end if;

  perform public._set_application_status(p_application_id, 'accepted');

  perform set_config('kuvo.allow_application_status', 'on', true);
  update public.applications
  set status = 'rejected', updated_at = now()
  where campaign_id = v_app.campaign_id
    and id <> p_application_id
    and status in ('pending', 'shortlisted');
  perform set_config('kuvo.allow_application_status', 'off', true);

  perform public._set_campaign_status(v_campaign.id, 'in_progress');

  insert into public.conversations(campaign_id)
  values (v_app.campaign_id)
  returning id into v_conversation_id;

  insert into public.conversation_members(conversation_id, profile_id)
  values
    (v_conversation_id, v_business_profile_id),
    (v_conversation_id, v_creator_profile_id);

  perform public._notify_account(v_creator_account_id, 'Postulación aceptada', 'Tu propuesta fue aceptada. Ya podés conversar con el negocio.', '/panel');
  perform public._notify_account(v_business_account_id, 'Colaboración confirmada', 'Aceptaste una postulación. Se abrió una conversación.', '/panel');

  perform public.write_audit_log(
    'business_accept_application',
    'applications',
    p_application_id,
    jsonb_build_object('conversation_id', v_conversation_id, 'campaign_id', v_app.campaign_id)
  );

  return v_conversation_id;
end;
$$;

-- Grants RPC
revoke all on function public.business_publish_campaign(uuid) from public;
revoke all on function public.business_pause_campaign(uuid) from public;
revoke all on function public.business_reopen_campaign(uuid) from public;
revoke all on function public.business_cancel_campaign(uuid) from public;
revoke all on function public.business_complete_campaign(uuid) from public;
grant execute on function public.business_publish_campaign(uuid) to authenticated;
grant execute on function public.business_pause_campaign(uuid) to authenticated;
grant execute on function public.business_reopen_campaign(uuid) to authenticated;
grant execute on function public.business_cancel_campaign(uuid) to authenticated;
grant execute on function public.business_complete_campaign(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas RLS con is_active_account (lecturas y escrituras privadas)
-- ---------------------------------------------------------------------------
drop policy if exists "business creates campaigns" on public.campaigns;
create policy "business creates campaigns"
  on public.campaigns for insert
  with check (
    public.is_admin()
    or (
      public.is_active_account()
      and exists(select 1 from public.business_profiles b where b.id = business_id and b.profile_id = public.current_profile_id())
    )
  );

drop policy if exists "business updates campaigns" on public.campaigns;
create policy "business updates campaigns"
  on public.campaigns for update
  using (
    public.is_admin()
    or (
      public.is_active_account()
      and exists(select 1 from public.business_profiles b where b.id = business_id and b.profile_id = public.current_profile_id())
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_active_account()
      and exists(select 1 from public.business_profiles b where b.id = business_id and b.profile_id = public.current_profile_id())
    )
  );

drop policy if exists "application parties select" on public.applications;
create policy "application parties select"
  on public.applications for select
  using (
    public.is_admin()
    or (
      public.is_active_account()
      and (
        exists(select 1 from public.creator_profiles c where c.id = creator_id and c.profile_id = public.current_profile_id())
        or exists(select 1 from public.campaigns ca join public.business_profiles b on b.id = ca.business_id where ca.id = campaign_id and b.profile_id = public.current_profile_id())
      )
    )
  );

drop policy if exists "application parties update" on public.applications;
create policy "application parties update"
  on public.applications for update
  using (
    public.is_admin()
    or (
      public.is_active_account()
      and exists(select 1 from public.creator_profiles c where c.id = creator_id and c.profile_id = public.current_profile_id())
      and status = 'pending'
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_active_account()
      and exists(select 1 from public.creator_profiles c where c.id = creator_id and c.profile_id = public.current_profile_id())
      and status = 'pending'
    )
  );

drop policy if exists "own favorites select" on public.favorites;
create policy "own favorites select"
  on public.favorites for select
  using ((account_id = auth.uid() and public.is_active_account()) or public.is_admin());

drop policy if exists "members select conversations" on public.conversations;
create policy "members select conversations"
  on public.conversations for select
  using ((public.is_active_account() and public.is_conversation_member(id)) or public.is_admin());

drop policy if exists "members select membership" on public.conversation_members;
create policy "members select membership"
  on public.conversation_members for select
  using ((public.is_active_account() and public.is_conversation_member(conversation_id)) or public.is_admin());

drop policy if exists "members read messages" on public.messages;
create policy "members read messages"
  on public.messages for select
  using ((public.is_active_account() and public.is_conversation_member(conversation_id)) or public.is_admin());

drop policy if exists "own notifications" on public.notifications;
create policy "own notifications"
  on public.notifications for select
  using ((account_id = auth.uid() and public.is_active_account()) or public.is_admin());

drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications update"
  on public.notifications for update
  using ((account_id = auth.uid() and public.is_active_account()) or public.is_admin());

-- Políticas de escritura (resto de 004, reforzadas)
drop policy if exists "owners update profile" on public.profiles;
create policy "owners update profile"
  on public.profiles for update
  using ((account_id = auth.uid() and public.is_active_account()) or public.is_admin())
  with check ((account_id = auth.uid() and public.is_active_account()) or public.is_admin());

drop policy if exists "creator applies" on public.applications;
create policy "creator applies"
  on public.applications for insert
  with check (
    public.is_active_account()
    and exists(select 1 from public.creator_profiles c where c.id = creator_id and c.profile_id = public.current_profile_id())
    and exists(select 1 from public.campaigns ca where ca.id = campaign_id and ca.status = 'open')
  );

drop policy if exists "own favorites insert" on public.favorites;
create policy "own favorites insert"
  on public.favorites for insert
  with check (account_id = auth.uid() and public.is_active_account());

drop policy if exists "own favorites delete" on public.favorites;
create policy "own favorites delete"
  on public.favorites for delete
  using ((account_id = auth.uid() and public.is_active_account()) or public.is_admin());

drop policy if exists "members send messages" on public.messages;
create policy "members send messages"
  on public.messages for insert
  with check (
    public.is_active_account()
    and sender_profile_id = public.current_profile_id()
    and public.is_conversation_member(conversation_id)
  );

drop policy if exists "members update own read state" on public.conversation_members;
create policy "members update own read state"
  on public.conversation_members for update
  using ((profile_id = public.current_profile_id() and public.is_active_account()) or public.is_admin());

drop policy if exists "campaign parties review" on public.reviews;
create policy "campaign parties review"
  on public.reviews for insert
  with check (
    public.is_active_account()
    and reviewer_profile_id = public.current_profile_id()
    and exists(select 1 from public.campaigns c where c.id = campaign_id and c.status = 'completed')
    and (
      exists(
        select 1 from public.applications a
        join public.creator_profiles cp on cp.id = a.creator_id
        join public.campaigns ca on ca.id = a.campaign_id
        join public.business_profiles bp on bp.id = ca.business_id
        where a.campaign_id = reviews.campaign_id and a.status = 'accepted'
          and cp.profile_id = public.current_profile_id() and bp.profile_id = reviewed_profile_id
      )
      or exists(
        select 1 from public.applications a
        join public.creator_profiles cp on cp.id = a.creator_id
        join public.campaigns ca on ca.id = a.campaign_id
        join public.business_profiles bp on bp.id = ca.business_id
        where a.campaign_id = reviews.campaign_id and a.status = 'accepted'
          and bp.profile_id = public.current_profile_id() and cp.profile_id = reviewed_profile_id
      )
    )
  );

-- Storage
drop policy if exists "users upload own media" on storage.objects;
create policy "users upload own media"
  on storage.objects for insert to authenticated
  with check (
    public.is_active_account()
    and bucket_id in ('avatars', 'portfolio')
    and (storage.foldername(name))[1] = public.current_profile_id()::text
  );

drop policy if exists "users update own media" on storage.objects;
create policy "users update own media"
  on storage.objects for update to authenticated
  using (
    public.is_active_account()
    and bucket_id in ('avatars', 'portfolio')
    and (storage.foldername(name))[1] = public.current_profile_id()::text
  );

drop policy if exists "users delete own media" on storage.objects;
create policy "users delete own media"
  on storage.objects for delete to authenticated
  using (
    public.is_active_account()
    and bucket_id in ('avatars', 'portfolio')
    and ((storage.foldername(name))[1] = public.current_profile_id()::text or public.is_admin())
  );

-- Realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
exception when others then
  raise notice 'Realtime: configurar manualmente en Supabase Dashboard si falla.';
end $$;
