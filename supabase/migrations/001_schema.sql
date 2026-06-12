-- KUVO — esquema principal para Supabase/PostgreSQL
--
-- ⚠️  SOLO para proyectos VACÍOS. Si ya existe la base (error "account_role already exists"),
--     NO ejecutes este archivo. Usá únicamente: supabase/migrations/003_security_hardening.sql
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
