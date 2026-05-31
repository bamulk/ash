-- Ashley Stone Homes — schema. Run in the Supabase SQL editor (or via MCP apply_migration).

create extension if not exists "pgcrypto";

-- ============ profiles (team members) ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ contacts ============
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  display_name text not null,
  emails text[] not null default '{}',
  phones text[] not null default '{}',
  street text,
  city text,
  state text,
  zip text,
  role text check (role in ('buyer','seller','both')),
  source text,
  birthday date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_display_name_idx on public.contacts (lower(display_name));
create index if not exists contacts_city_idx on public.contacts (lower(city));
create index if not exists contacts_role_idx on public.contacts (role);

-- ============ tags + contact_tags ============
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'slate',
  created_at timestamptz not null default now()
);

create table if not exists public.contact_tags (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

create index if not exists contact_tags_tag_idx on public.contact_tags (tag_id);

-- ============ transactions (closed deals) ============
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  client_name text not null,
  address text,
  closed_date date,
  source_of_business text,
  deal_type text check (deal_type in ('buyer','seller')),
  sold_price numeric(14,2),
  commission_pct numeric(6,3),
  gci numeric(14,2),
  broker_share numeric(14,2),
  admin_fee numeric(14,2),
  agent_share numeric(14,2),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_contact_idx on public.transactions (contact_id);
create index if not exists transactions_closed_date_idx on public.transactions (closed_date);

-- ============ segments (saved contact filters) ============
create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  criteria jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============ campaigns ============
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'postcard' check (kind in ('postcard','card','mailer','other')),
  segment_id uuid references public.segments(id) on delete set null,
  scheduled_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','done')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists campaigns_status_idx on public.campaigns (status);

-- ============ campaign_contacts (touch log) ============
create table if not exists public.campaign_contacts (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  touched_at timestamptz,
  status text not null default 'included' check (status in ('included','sent','skipped')),
  primary key (campaign_id, contact_id)
);

create index if not exists campaign_contacts_contact_idx on public.campaign_contacts (contact_id);

-- ============ reminders ============
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_date date not null,
  kind text not null default 'task' check (kind in ('follow_up','anniversary','birthday','task')),
  contact_id uuid references public.contacts(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  recurrence text not null default 'none' check (recurrence in ('none','annual')),
  is_done boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists reminders_due_idx on public.reminders (due_date) where is_done = false;
create index if not exists reminders_contact_idx on public.reminders (contact_id);

-- ============ home_valuations (RentCast AVM snapshots) ============
create table if not exists public.home_valuations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  address text not null,
  estimate numeric(14,2),
  range_low numeric(14,2),
  range_high numeric(14,2),
  source text not null default 'rentcast',
  raw jsonb,
  queried_at timestamptz not null default now(),
  queried_by uuid references public.profiles(id) on delete set null
);

create index if not exists home_valuations_contact_idx
  on public.home_valuations (contact_id, queried_at desc);

-- ============ updated_at trigger for contacts ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists contacts_touch_updated_at on public.contacts;
create trigger contacts_touch_updated_at
  before update on public.contacts
  for each row execute procedure public.touch_updated_at();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.transactions enable row level security;
alter table public.segments enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_contacts enable row level security;
alter table public.reminders enable row level security;
alter table public.home_valuations enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles
drop policy if exists "profiles_select_all_authed" on public.profiles;
create policy "profiles_select_all_authed" on public.profiles
  for select using (auth.role() = 'authenticated');
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
  for insert with check (public.is_admin());
drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete" on public.profiles
  for delete using (public.is_admin());

-- All business tables: any authenticated user can CRUD (small trusted team).
do $$
declare t text;
begin
  foreach t in array array[
    'contacts','tags','contact_tags','transactions',
    'segments','campaigns','campaign_contacts','reminders','home_valuations'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_authed_all', t);
    execute format(
      'create policy %I on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t || '_authed_all', t
    );
  end loop;
end $$;
