-- =============================================================================
-- KUVO DATABASE COMPLETE
-- SOLO instalacion NUEVA (proyecto Supabase vacio).
-- Si 001 ya existe: NO usar este archivo. Aplicar 003, 004 y 005 por separado.
-- =============================================================================


-- >>> supabase/migrations/001_schema.sql

-- KUVO â€” esquema principal para Supabase/PostgreSQL
--
-- âš ï¸  SOLO para proyectos VACÃOS. Si ya existe la base (error "account_role already exists"),
--     NO ejecutes este archivo. UsÃ¡ Ãºnicamente: supabase/migrations/003_security_hardening.sql
--
create extension if not exists pgcrypto;

create type public.account_role as enum ('business','creator','admin');
create type public.campaign_status as enum ('draft','open','paused','completed','cancelled');
create type public.application_status as enum ('pending','shortlisted','accepted','rejected','withdrawn');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid unique references auth.users(id) on delete cascade,
  role public.account_role not null default 'creator',
  full_name text not null check (char_length(full_name) between 2 and 100),
  username text unique,
  city text,
  avatar_url text,
  bio text check (char_length(coalesce(bio,'')) <= 1000),
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  categories text[] not null default '{}',
  instagram text,
  tiktok text,
  youtube text,
  followers integer not null default 0 check (followers >= 0),
  engagement numeric(6,2) not null default 0 check (engagement >= 0 and engagement <= 100),
  starting_price integer not null default 0 check (starting_price >= 0),
  score numeric(5,2) not null default 70 check (score >= 0 and score <= 100),
  availability boolean not null default true,
  portfolio jsonb not null default '[]'::jsonb,
  experience text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 120),
  industry text,
  website text,
  location text,
  logo_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  description text not null check (char_length(description) between 10 and 4000),
  category text not null,
  city text not null default 'Argentina',
  budget_min integer not null default 0 check (budget_min >= 0),
  budget_max integer not null default 0 check (budget_max >= budget_min),
  deliverables text[] not null default '{}',
  status public.campaign_status not null default 'draft',
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  message text not null check (char_length(message) between 5 and 2000),
  proposed_price integer not null default 0 check (proposed_price >= 0),
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, creator_id)
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(account_id, creator_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key(conversation_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_profile_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(coalesce(comment,'')) <= 1500),
  created_at timestamptz not null default now(),
  unique(campaign_id, reviewer_profile_id, reviewed_profile_id),
  check (reviewer_profile_id <> reviewed_profile_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_account_idx on public.profiles(account_id);
create index profiles_role_active_idx on public.profiles(role, active);
create index creator_profiles_categories_idx on public.creator_profiles using gin(categories);
create index campaigns_status_category_city_idx on public.campaigns(status, category, city);
create index campaigns_business_idx on public.campaigns(business_id, created_at desc);
create index applications_campaign_idx on public.applications(campaign_id, created_at desc);
create index applications_creator_idx on public.applications(creator_id, created_at desc);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
create index notifications_account_idx on public.notifications(account_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger creator_profiles_updated before update on public.creator_profiles for each row execute function public.set_updated_at();
create trigger business_profiles_updated before update on public.business_profiles for each row execute function public.set_updated_at();
create trigger campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();
create trigger applications_updated before update on public.applications for each row execute function public.set_updated_at();
create trigger conversations_updated before update on public.conversations for each row execute function public.set_updated_at();

create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where account_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where account_id = auth.uid() and role = 'admin' and active = true);
$$;

grant execute on function public.current_profile_id() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.conversation_members cm where cm.conversation_id=target_conversation and cm.profile_id=public.current_profile_id());
$$;
grant execute on function public.is_conversation_member(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_role public.account_role;
  new_profile_id uuid;
begin
  new_role := case lower(coalesce(new.raw_user_meta_data->>'role','creator'))
    when 'business' then 'business'::public.account_role
    when 'admin' then 'creator'::public.account_role
    else 'creator'::public.account_role
  end;

  insert into public.profiles(account_id, role, full_name, username)
  values (
    new.id,
    new_role,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1)),
    lower(regexp_replace(split_part(new.email,'@',1),'[^a-zA-Z0-9_]','','g')) || '_' || substr(new.id::text,1,5)
  ) returning id into new_profile_id;

  if new_role = 'creator' then
    insert into public.creator_profiles(profile_id) values (new_profile_id);
  else
    insert into public.business_profiles(profile_id, business_name)
    values (new_profile_id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Mi negocio'));
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.applications enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

create policy "public profiles are visible" on public.profiles for select using (active = true or account_id = auth.uid() or public.is_admin());
create policy "owners update profile" on public.profiles for update using (account_id = auth.uid() or public.is_admin()) with check (account_id = auth.uid() or public.is_admin());

create policy "creator profiles visible" on public.creator_profiles for select using (exists(select 1 from public.profiles p where p.id=profile_id and (p.active=true or p.account_id=auth.uid())) or public.is_admin());
create policy "owners create creator profile" on public.creator_profiles for insert with check (profile_id=public.current_profile_id() or public.is_admin());
create policy "owners update creator profile" on public.creator_profiles for update using (profile_id=public.current_profile_id() or public.is_admin()) with check (profile_id=public.current_profile_id() or public.is_admin());

create policy "business profiles visible" on public.business_profiles for select using (exists(select 1 from public.profiles p where p.id=profile_id and (p.active=true or p.account_id=auth.uid())) or public.is_admin());
create policy "owners create business profile" on public.business_profiles for insert with check (profile_id=public.current_profile_id() or public.is_admin());
create policy "owners update business profile" on public.business_profiles for update using (profile_id=public.current_profile_id() or public.is_admin()) with check (profile_id=public.current_profile_id() or public.is_admin());

create policy "open campaigns visible" on public.campaigns for select using (
  status='open' or public.is_admin() or exists(select 1 from public.business_profiles b where b.id=business_id and b.profile_id=public.current_profile_id())
);
create policy "business creates campaigns" on public.campaigns for insert with check (public.is_admin() or exists(select 1 from public.business_profiles b where b.id=business_id and b.profile_id=public.current_profile_id()));
create policy "business updates campaigns" on public.campaigns for update using (public.is_admin() or exists(select 1 from public.business_profiles b where b.id=business_id and b.profile_id=public.current_profile_id())) with check (public.is_admin() or exists(select 1 from public.business_profiles b where b.id=business_id and b.profile_id=public.current_profile_id()));
create policy "business deletes campaigns" on public.campaigns for delete using (public.is_admin() or exists(select 1 from public.business_profiles b where b.id=business_id and b.profile_id=public.current_profile_id()));

create policy "application parties select" on public.applications for select using (
  public.is_admin()
  or exists(select 1 from public.creator_profiles c where c.id=creator_id and c.profile_id=public.current_profile_id())
  or exists(select 1 from public.campaigns ca join public.business_profiles b on b.id=ca.business_id where ca.id=campaign_id and b.profile_id=public.current_profile_id())
);
create policy "creator applies" on public.applications for insert with check (
  exists(select 1 from public.creator_profiles c where c.id=creator_id and c.profile_id=public.current_profile_id())
  and exists(select 1 from public.campaigns ca where ca.id=campaign_id and ca.status='open')
);
create policy "application parties update" on public.applications for update using (
  public.is_admin()
  or exists(select 1 from public.creator_profiles c where c.id=creator_id and c.profile_id=public.current_profile_id())
  or exists(select 1 from public.campaigns ca join public.business_profiles b on b.id=ca.business_id where ca.id=campaign_id and b.profile_id=public.current_profile_id())
);

create policy "own favorites select" on public.favorites for select using (account_id=auth.uid() or public.is_admin());
create policy "own favorites insert" on public.favorites for insert with check (account_id=auth.uid());
create policy "own favorites delete" on public.favorites for delete using (account_id=auth.uid() or public.is_admin());

create policy "members select conversations" on public.conversations for select using (public.is_admin() or public.is_conversation_member(id));
create policy "authenticated create conversations" on public.conversations for insert to authenticated with check (true);
create policy "members update conversations" on public.conversations for update using (public.is_admin() or public.is_conversation_member(id));

create policy "members select membership" on public.conversation_members for select using (public.is_admin() or public.is_conversation_member(conversation_id));
create policy "members add membership" on public.conversation_members for insert to authenticated with check (public.is_admin() or profile_id=public.current_profile_id() or public.is_conversation_member(conversation_id));
create policy "members update own read state" on public.conversation_members for update using (profile_id=public.current_profile_id() or public.is_admin());

create policy "members read messages" on public.messages for select using (public.is_admin() or public.is_conversation_member(messages.conversation_id));
create policy "members send messages" on public.messages for insert with check (sender_profile_id=public.current_profile_id() and public.is_conversation_member(messages.conversation_id));

create policy "reviews public" on public.reviews for select using (true);
create policy "campaign parties review" on public.reviews for insert with check (
  reviewer_profile_id=public.current_profile_id()
  and exists(select 1 from public.campaigns c where c.id=campaign_id and c.status='completed')
  and (
    exists(select 1 from public.applications a join public.creator_profiles cp on cp.id=a.creator_id where a.campaign_id=reviews.campaign_id and a.status='accepted' and cp.profile_id=public.current_profile_id())
    or exists(select 1 from public.campaigns ca join public.business_profiles bp on bp.id=ca.business_id where ca.id=reviews.campaign_id and bp.profile_id=public.current_profile_id())
  )
);
create policy "reviewer updates review" on public.reviews for update using (reviewer_profile_id=public.current_profile_id() or public.is_admin());

create policy "own notifications" on public.notifications for select using (account_id=auth.uid() or public.is_admin());
create policy "own notifications update" on public.notifications for update using (account_id=auth.uid() or public.is_admin());


grant usage on schema public to anon, authenticated;
revoke all on public.profiles from anon;
grant select (id, role, full_name, username, city, avatar_url, bio, verified, active, created_at, updated_at) on public.profiles to anon;
grant select on public.creator_profiles, public.business_profiles, public.campaigns, public.reviews to anon;
grant select, insert, update, delete on public.profiles, public.creator_profiles, public.business_profiles, public.campaigns, public.applications, public.favorites, public.conversations, public.conversation_members, public.messages, public.reviews, public.notifications to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
  ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('portfolio','portfolio',true,15728640,array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do nothing;

create policy "public media read" on storage.objects for select using (bucket_id in ('avatars','portfolio'));
create policy "users upload own media" on storage.objects for insert to authenticated with check (bucket_id in ('avatars','portfolio') and (storage.foldername(name))[1]=public.current_profile_id()::text);
create policy "users update own media" on storage.objects for update to authenticated using (bucket_id in ('avatars','portfolio') and (storage.foldername(name))[1]=public.current_profile_id()::text);
create policy "users delete own media" on storage.objects for delete to authenticated using (bucket_id in ('avatars','portfolio') and ((storage.foldername(name))[1]=public.current_profile_id()::text or public.is_admin()));

-- >>> supabase/migrations/003_security_hardening.sql

-- KUVO 003 â€” Endurecimiento de seguridad (P0)
-- Ejecutar en bases existentes que ya tengan 001_schema.sql (+ opcional 002_seed.sql)

-- ---------------------------------------------------------------------------
-- AuditorÃ­a administrativa
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
-- MÃ©tricas declaradas vs calculadas (creador)
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
      raise exception 'No tenÃ©s permiso para modificar el rol.';
    end if;
    if new.verified is distinct from old.verified then
      raise exception 'No tenÃ©s permiso para modificar la verificaciÃ³n.';
    end if;
    if new.active is distinct from old.active then
      raise exception 'No tenÃ©s permiso para modificar el estado activo.';
    end if;
    if new.account_id is distinct from old.account_id then
      raise exception 'No tenÃ©s permiso para modificar account_id.';
    end if;
    if new.id is distinct from old.id then
      raise exception 'No tenÃ©s permiso para modificar id.';
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
      raise exception 'La verificaciÃ³n del negocio solo puede asignarla un administrador.';
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
    raise exception 'No podÃ©s modificar la campaÃ±a o el creador de una postulaciÃ³n.';
  end if;

  if v_is_creator then
    if not v_is_business then
      if old.status not in ('pending') then
        raise exception 'Solo podÃ©s editar postulaciones pendientes.';
      end if;
      if new.status is distinct from old.status and new.status not in ('pending', 'withdrawn') then
        raise exception 'Estado de postulaciÃ³n no permitido para creador.';
      end if;
      if new.message is distinct from old.message
         or new.proposed_price is distinct from old.proposed_price then
        if new.status not in ('pending', 'withdrawn') then
          raise exception 'No podÃ©s editar una postulaciÃ³n en este estado.';
        end if;
      end if;
    end if;
  elsif v_is_business then
    if new.message is distinct from old.message
       or new.proposed_price is distinct from old.proposed_price then
      raise exception 'No podÃ©s modificar la propuesta del creador.';
    end if;
    if new.status is distinct from old.status then
      if not (
        (old.status = 'pending' and new.status in ('shortlisted', 'accepted', 'rejected', 'withdrawn'))
        or (old.status = 'shortlisted' and new.status in ('accepted', 'rejected'))
      ) then
        raise exception 'TransiciÃ³n de estado no permitida.';
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
-- PolÃ­ticas: conversaciones controladas
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
-- ReseÃ±as: contraparte obligatoria
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
  if not found then raise exception 'PostulaciÃ³n no encontrada.'; end if;

  if not exists(
    select 1 from public.creator_profiles c
    where c.id = v_app.creator_id and c.profile_id = public.current_profile_id()
  ) then
    raise exception 'No autorizado.';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'Solo podÃ©s retirar postulaciones pendientes.';
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
  if not found then raise exception 'PostulaciÃ³n no encontrada.'; end if;

  if not exists(
    select 1 from public.campaigns ca
    join public.business_profiles b on b.id = ca.business_id
    where ca.id = v_app.campaign_id and b.profile_id = public.current_profile_id()
  ) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'Solo podÃ©s preseleccionar postulaciones pendientes.';
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
  if not found then raise exception 'PostulaciÃ³n no encontrada.'; end if;

  if not exists(
    select 1 from public.campaigns ca
    join public.business_profiles b on b.id = ca.business_id
    where ca.id = v_app.campaign_id and b.profile_id = public.current_profile_id()
  ) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  if v_app.status not in ('pending', 'shortlisted') then
    raise exception 'Estado invÃ¡lido para rechazar.';
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
  if not found then raise exception 'PostulaciÃ³n no encontrada.'; end if;

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
    raise exception 'Estado invÃ¡lido para aceptar.';
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
    'PostulaciÃ³n aceptada',
    'Tu propuesta fue aceptada. Ya podÃ©s conversar con el negocio.',
    '/panel'
  );
  perform public._notify_account(
    v_business_account_id,
    'ColaboraciÃ³n confirmada',
    'Aceptaste una postulaciÃ³n. Se abriÃ³ una conversaciÃ³n.',
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
-- Storage: quitar SVG pÃºblico sin sanitizaciÃ³n
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'avatars';

update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4']
where id = 'portfolio';

-- >>> supabase/migrations/004_add_campaign_in_progress.sql

-- KUVO 004 â€” Agregar estado in_progress al enum campaign_status
-- Ejecutar SOLO este archivo antes de 005_production_hardening.sql
-- PostgreSQL exige commit entre ADD VALUE y uso del nuevo valor.

do $$
begin
  alter type public.campaign_status add value if not exists 'in_progress';
exception
  when duplicate_object then null;
end $$;

-- >>> supabase/migrations/005_production_hardening.sql

-- KUVO 005 â€” Endurecimiento de producciÃ³n (V1)
-- Requisitos: 001 + 003 aplicados, y 004_add_campaign_in_progress.sql ejecutado en sesiÃ³n previa.

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
      raise exception 'No tenÃ©s permiso para modificar el rol.';
    end if;
    if new.verified is distinct from old.verified then
      raise exception 'No tenÃ©s permiso para modificar la verificaciÃ³n.';
    end if;
    if new.active is distinct from old.active then
      raise exception 'No tenÃ©s permiso para modificar el estado activo.';
    end if;
    if new.account_id is distinct from old.account_id then
      raise exception 'No tenÃ©s permiso para modificar account_id.';
    end if;
    if new.id is distinct from old.id then
      raise exception 'No tenÃ©s permiso para modificar id.';
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
    raise exception 'No podÃ©s modificar la campaÃ±a o el creador de una postulaciÃ³n.';
  end if;

  if v_is_creator then
    if old.status <> 'pending' then
      raise exception 'Solo podÃ©s editar postulaciones pendientes.';
    end if;
    if new.message is distinct from old.message
       or new.proposed_price is distinct from old.proposed_price then
      null;
    end if;
  else
    if new.message is distinct from old.message
       or new.proposed_price is distinct from old.proposed_price then
      raise exception 'No podÃ©s modificar la propuesta del creador.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_conversation_member_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.conversation_id is distinct from old.conversation_id
     or new.profile_id is distinct from old.profile_id
     or new.joined_at is distinct from old.joined_at then
    raise exception 'No podÃ©s modificar membresÃ­a.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_notification_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.account_id is distinct from old.account_id
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.action_url is distinct from old.action_url
     or new.created_at is distinct from old.created_at then
    raise exception 'No podÃ©s modificar campos de la notificaciÃ³n.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_review_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.campaign_id is distinct from old.campaign_id
     or new.reviewer_profile_id is distinct from old.reviewer_profile_id
     or new.reviewed_profile_id is distinct from old.reviewed_profile_id then
    raise exception 'No podÃ©s modificar los participantes de una reseÃ±a.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_application_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.status is distinct from 'pending' then
    raise exception 'Las postulaciones deben crearse como pending.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_report_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reporter_profile_id is distinct from old.reporter_profile_id
     or new.target_type is distinct from old.target_type
     or new.target_id is distinct from old.target_id
     or new.reason is distinct from old.reason
     or new.details is distinct from old.details
     or new.created_at is distinct from old.created_at then
    raise exception 'No podÃ©s modificar los datos base de un reporte.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_campaign_status_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if current_setting('kuvo.allow_campaign_status', true) <> 'on' then
    if new.status is distinct from old.status then
      raise exception 'Los cambios de estado de campaÃ±a solo pueden hacerse mediante RPC.';
    end if;
  end if;
  if new.business_id is distinct from old.business_id then
    raise exception 'No podÃ©s modificar el negocio de una campaÃ±a.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_campaigns_status on public.campaigns;
create trigger guard_campaigns_status
  before update on public.campaigns
  for each row execute function public.guard_campaign_status_fields();

drop trigger if exists guard_conversation_members_fields on public.conversation_members;
create trigger guard_conversation_members_fields
  before update on public.conversation_members
  for each row execute function public.guard_conversation_member_fields();

drop trigger if exists guard_notifications_fields on public.notifications;
create trigger guard_notifications_fields
  before update on public.notifications
  for each row execute function public.guard_notification_fields();

drop trigger if exists guard_reviews_fields on public.reviews;
create trigger guard_reviews_fields
  before update on public.reviews
  for each row execute function public.guard_review_fields();

drop trigger if exists guard_applications_insert on public.applications;
create trigger guard_applications_insert
  before insert on public.applications
  for each row execute function public.guard_application_insert();

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
    raise exception 'No se encontrÃ³ perfil para el correo indicado.';
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
-- 1.3 AuditorÃ­a protegida
-- ---------------------------------------------------------------------------
revoke all on function public.write_audit_log(text, text, uuid, jsonb) from authenticated, anon, public;
revoke all on function public._notify_account(uuid, text, text, text) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- 1.4 Unicidad aceptaciÃ³n / conversaciÃ³n
-- ---------------------------------------------------------------------------
create unique index if not exists applications_one_accepted_per_campaign_idx
  on public.applications (campaign_id)
  where status = 'accepted';

create unique index if not exists conversations_one_per_campaign_idx
  on public.conversations (campaign_id)
  where campaign_id is not null;

-- ---------------------------------------------------------------------------
-- Permisos por columna: campaÃ±as y postulaciones
-- ---------------------------------------------------------------------------
revoke update on public.campaigns from authenticated;
grant update (title, description, category, city, budget_min, budget_max, deliverables, deadline)
  on public.campaigns to authenticated;

revoke update on public.applications from authenticated;
grant update (message, proposed_price)
  on public.applications to authenticated;

revoke update on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke update on public.reviews from authenticated;
grant update (rating, comment) on public.reviews to authenticated;

-- ---------------------------------------------------------------------------
-- Tabla reports (moderaciÃ³n)
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
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.reports from anon;
grant select, insert on public.reports to authenticated;
revoke update on public.reports from authenticated;
grant update (status, resolved_at) on public.reports to authenticated;

drop trigger if exists guard_reports_fields on public.reports;
create trigger guard_reports_fields
  before update on public.reports
  for each row execute function public.guard_report_fields();

-- ---------------------------------------------------------------------------
-- Helper: transiciones de campaÃ±a
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
    raise exception 'TransiciÃ³n de campaÃ±a no permitida: % â†’ %', p_from, p_to;
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
  if not found then raise exception 'CampaÃ±a no encontrada.'; end if;
  perform public._assert_campaign_transition(v_campaign.status, p_to);
  perform set_config('kuvo.allow_campaign_status', 'on', true);
  update public.campaigns set status = p_to, updated_at = now() where id = p_campaign_id;
  perform set_config('kuvo.allow_campaign_status', 'off', true);
end;
$$;

revoke all on function public._set_campaign_status(uuid, public.campaign_status) from public;

-- ---------------------------------------------------------------------------
-- RPC campaÃ±as
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
  if not found then raise exception 'CampaÃ±a no encontrada.'; end if;
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
  if not found then raise exception 'PostulaciÃ³n no encontrada.'; end if;
  if not exists(select 1 from public.creator_profiles c join public.profiles p on p.id = c.profile_id where c.id = v_app.creator_id and c.profile_id = public.current_profile_id() and p.active = true) then
    raise exception 'No autorizado.';
  end if;
  if v_app.status <> 'pending' then raise exception 'Solo podÃ©s retirar postulaciones pendientes.'; end if;
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
  if not found then raise exception 'PostulaciÃ³n no encontrada.'; end if;
  select * into v_campaign from public.campaigns where id = v_app.campaign_id for update;
  if v_campaign.status <> 'open' then raise exception 'La campaÃ±a no acepta cambios de postulaciÃ³n.'; end if;
  if not exists(select 1 from public.business_profiles b join public.profiles p on p.id = b.profile_id where b.id = v_campaign.business_id and b.profile_id = public.current_profile_id() and p.active = true) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if v_app.status <> 'pending' then raise exception 'Solo podÃ©s preseleccionar postulaciones pendientes.'; end if;
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
  if not found then raise exception 'PostulaciÃ³n no encontrada.'; end if;
  if not exists(select 1 from public.campaigns ca join public.business_profiles b on b.id = ca.business_id join public.profiles p on p.id = b.profile_id where ca.id = v_app.campaign_id and b.profile_id = public.current_profile_id() and p.active = true) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if v_app.status not in ('pending', 'shortlisted') then raise exception 'Estado invÃ¡lido para rechazar.'; end if;
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
  if not found then raise exception 'PostulaciÃ³n no encontrada.'; end if;

  select * into v_campaign from public.campaigns where id = v_app.campaign_id for update;
  if not found then raise exception 'CampaÃ±a no encontrada.'; end if;

  select b.profile_id, p.account_id
    into v_business_profile_id, v_business_account_id
  from public.business_profiles b
  join public.profiles p on p.id = b.profile_id
  where b.id = v_campaign.business_id;

  if v_business_profile_id is distinct from public.current_profile_id() and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  if not exists(select 1 from public.profiles where id = v_business_profile_id and active = true) then
    raise exception 'El negocio no estÃ¡ activo.';
  end if;

  select cp.profile_id, p.account_id
    into v_creator_profile_id, v_creator_account_id
  from public.creator_profiles cp
  join public.profiles p on p.id = cp.profile_id
  where cp.id = v_app.creator_id;

  if not exists(select 1 from public.profiles where id = v_creator_profile_id and active = true) then
    raise exception 'El creador no estÃ¡ activo.';
  end if;

  select id into v_conversation_id from public.conversations where campaign_id = v_app.campaign_id limit 1;

  if v_app.status = 'accepted' then
    if v_conversation_id is null then
      raise exception 'PostulaciÃ³n aceptada sin conversaciÃ³n asociada.';
    end if;
    if (select count(*) from public.conversation_members where conversation_id = v_conversation_id) <> 2 then
      raise exception 'ConversaciÃ³n con membresÃ­a invÃ¡lida.';
    end if;
    if not exists(
      select 1 from public.conversation_members cm
      where cm.conversation_id = v_conversation_id and cm.profile_id = v_business_profile_id
    ) or not exists(
      select 1 from public.conversation_members cm
      where cm.conversation_id = v_conversation_id and cm.profile_id = v_creator_profile_id
    ) then
      raise exception 'La conversaciÃ³n no coincide con los participantes de la postulaciÃ³n.';
    end if;
    return v_conversation_id;
  end if;

  if v_conversation_id is not null then
    raise exception 'Ya existe una conversaciÃ³n para esta campaÃ±a sin postulaciÃ³n aceptada correspondiente.';
  end if;

  select id into v_other_accepted
  from public.applications
  where campaign_id = v_app.campaign_id and status = 'accepted' and id <> p_application_id
  limit 1;

  if v_other_accepted is not null then
    raise exception 'Esta campaÃ±a ya tiene un creador aceptado.';
  end if;

  if v_campaign.status <> 'open' then
    raise exception 'La campaÃ±a no estÃ¡ abierta para aceptar postulaciones.';
  end if;

  if v_app.status not in ('pending', 'shortlisted') then
    raise exception 'Estado invÃ¡lido para aceptar.';
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

  perform public._notify_account(v_creator_account_id, 'PostulaciÃ³n aceptada', 'Tu propuesta fue aceptada. Ya podÃ©s conversar con el negocio.', '/panel');
  perform public._notify_account(v_business_account_id, 'ColaboraciÃ³n confirmada', 'Aceptaste una postulaciÃ³n. Se abriÃ³ una conversaciÃ³n.', '/panel');

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
-- PolÃ­ticas RLS con is_active_account (lecturas y escrituras privadas)
-- ---------------------------------------------------------------------------
drop policy if exists "business creates campaigns" on public.campaigns;
create policy "business creates campaigns"
  on public.campaigns for insert
  with check (
    public.is_admin()
    or (
      public.is_active_account()
      and status = 'draft'
      and exists(select 1 from public.business_profiles b where b.id = business_id and b.profile_id = public.current_profile_id())
    )
  );

drop policy if exists "business deletes campaigns" on public.campaigns;
create policy "business deletes draft campaigns"
  on public.campaigns for delete
  using (
    public.is_admin()
    or (
      public.is_active_account()
      and status = 'draft'
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
  using ((account_id = auth.uid() and public.is_active_account()) or public.is_admin())
  with check ((account_id = auth.uid() and public.is_active_account()) or public.is_admin());

-- PolÃ­ticas de escritura (resto de 004, reforzadas)
drop policy if exists "owners update profile" on public.profiles;
create policy "owners update profile"
  on public.profiles for update
  using ((account_id = auth.uid() and public.is_active_account()) or public.is_admin())
  with check ((account_id = auth.uid() and public.is_active_account()) or public.is_admin());

drop policy if exists "owners update creator profile" on public.creator_profiles;
create policy "owners update creator profile"
  on public.creator_profiles for update
  using ((profile_id = public.current_profile_id() and public.is_active_account()) or public.is_admin())
  with check ((profile_id = public.current_profile_id() and public.is_active_account()) or public.is_admin());

drop policy if exists "owners update business profile" on public.business_profiles;
create policy "owners update business profile"
  on public.business_profiles for update
  using ((profile_id = public.current_profile_id() and public.is_active_account()) or public.is_admin())
  with check ((profile_id = public.current_profile_id() and public.is_active_account()) or public.is_admin());

drop policy if exists "creator applies" on public.applications;
create policy "creator applies"
  on public.applications for insert
  with check (
    public.is_active_account()
    and status = 'pending'
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
  using ((profile_id = public.current_profile_id() and public.is_active_account()) or public.is_admin())
  with check ((profile_id = public.current_profile_id() and public.is_active_account()) or public.is_admin());

drop policy if exists "reviewer updates review" on public.reviews;
create policy "reviewer updates review"
  on public.reviews for update
  using (
    (public.is_active_account() and reviewer_profile_id = public.current_profile_id())
    or public.is_admin()
  )
  with check (
    (public.is_active_account() and reviewer_profile_id = public.current_profile_id())
    or public.is_admin()
  );

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
