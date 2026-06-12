-- KUVO — esquema principal para Supabase/PostgreSQL
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
-- Datos públicos de muestra. Se pueden borrar después de cargar perfiles reales.
insert into public.profiles (id,role,full_name,username,city,bio,verified,active) values
('10000000-0000-0000-0000-000000000001','creator','Vale López','valelopez','Buenos Aires','Moda, belleza y lifestyle con contenido auténtico y orientado a conversión.',true,true),
('10000000-0000-0000-0000-000000000002','creator','Santi Ríos','santirios','Córdoba','Entrenamiento, hábitos y reseñas honestas para comunidades activas.',true,true),
('10000000-0000-0000-0000-000000000003','creator','Mai Morales','maimorales','Mendoza','Viajes y experiencias premium con estética editorial.',true,true),
('10000000-0000-0000-0000-000000000004','creator','Tomi Cáceres','tomicaceres','Rosario','Tecnología explicada de manera simple y entretenida.',true,true),
('10000000-0000-0000-0000-000000000005','creator','Luz Herrera','luzherrera','San Juan','Recomendaciones locales, planes familiares y gastronomía en Cuyo.',true,true),
('10000000-0000-0000-0000-000000000006','creator','Nico Paz','nicopaz','Buenos Aires','Humor cotidiano e integraciones naturales.',true,true),
('20000000-0000-0000-0000-000000000001','business','Brasa Norte','brasanorte','San Juan','Restaurante de cocina argentina.',true,true),
('20000000-0000-0000-0000-000000000002','business','Marea','marea','Mendoza','Marca de indumentaria urbana.',true,true),
('20000000-0000-0000-0000-000000000003','business','Punto App','puntoapp','Buenos Aires','Tecnología para comercios.',true,true),
('20000000-0000-0000-0000-000000000004','business','Aura Club','auraclub','Córdoba','Bienestar y entrenamiento.',true,true)
on conflict (id) do nothing;

insert into public.creator_profiles (id,profile_id,categories,followers,engagement,starting_price,score,availability,portfolio) values
('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',array['Moda','Belleza','Lifestyle'],128000,6.3,80000,94,true,'[{"title":"Reel de lanzamiento"},{"title":"Historia con enlace"},{"title":"Contenido UGC"}]'),
('11000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',array['Fitness','Deportes','Bienestar'],95000,7.1,70000,92,true,'[{"title":"Rutina patrocinada"},{"title":"Review de producto"}]'),
('11000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003',array['Viajes','Lifestyle','Gastronomía'],200000,5.8,120000,96,true,'[{"title":"Cobertura de hotel"},{"title":"Guía gastronómica"}]'),
('11000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004',array['Tecnología','Gaming','Apps'],75000,6.2,80000,90,true,'[{"title":"Demo de app"},{"title":"Unboxing"}]'),
('11000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005',array['Gastronomía','Familia','Eventos'],42000,9.4,52000,91,true,'[{"title":"Visita al local"},{"title":"Historia con reserva"}]'),
('11000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000006',array['Humor','Entretenimiento','Lifestyle'],310000,8.1,175000,95,true,'[{"title":"Sketch integrado"},{"title":"Evento en vivo"}]')
on conflict (id) do nothing;

insert into public.business_profiles (id,profile_id,business_name,industry,location,verified) values
('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Brasa Norte','Gastronomía','San Juan',true),
('21000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Marea','Moda','Mendoza',true),
('21000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','Punto App','Tecnología','Argentina',true),
('21000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004','Aura Club','Fitness','Córdoba',true)
on conflict (id) do nothing;

insert into public.campaigns (id,business_id,title,description,category,city,budget_min,budget_max,deliverables,status,deadline) values
('30000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','Noche parrillera','Buscamos creadores locales para mostrar la experiencia completa del restaurante y generar reservas.','Gastronomía','San Juan',180000,260000,array['1 reel','3 historias','CTA a reservas'],'open','2026-07-01'),
('30000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','Colección urbana','Contenido UGC y reels para el lanzamiento de temporada, con derecho de uso por 60 días.','Moda','Mendoza',130000,210000,array['2 videos UGC','5 fotos'],'open','2026-07-10'),
('30000000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000003','Lanzamiento de aplicación','Creadores de tecnología y emprendimiento para explicar una aplicación de forma simple.','Tecnología','Argentina',220000,350000,array['1 demo','1 reel','2 historias'],'open','2026-07-15'),
('30000000-0000-0000-0000-000000000004','21000000-0000-0000-0000-000000000004','Experiencia wellness','Jornada presencial con historias, un reel y reseña de experiencia.','Fitness','Córdoba',110000,170000,array['1 reel','4 historias'],'open','2026-06-28')
on conflict (id) do nothing;
 
 - -   = = =   0 0 3 _ s e c u r i t y _ h a r d e n i n g   = = =  
 -- KUVO 003 — Endurecimiento de seguridad (P0)
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
