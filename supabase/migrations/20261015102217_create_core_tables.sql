create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('agency', 'client')),
  created_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  name text not null,
  owner_profile_id uuid not null references public.profiles (id),
  status text not null default 'draft' check (status in ('draft', 'live', 'suspended')),
  published_version_id uuid,
  created_at timestamptz not null default now()
);

create table public.site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  document jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.sites
  add constraint sites_published_version_fk
  foreign key (published_version_id) references public.site_versions (id);

create index site_versions_site_created_idx
  on public.site_versions (site_id, created_at desc);

create table public.entitlements (
  site_id uuid primary key references public.sites (id) on delete cascade,
  plan text not null default 'none' check (plan in ('none', 'editing')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text
);

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.blobs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  url text not null,
  size bigint not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role)
  values (new.id, 'client');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_versions enable row level security;
alter table public.entitlements enable row level security;
alter table public.form_submissions enable row level security;
alter table public.blobs enable row level security;

create or replace function public.is_agency()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'agency'
  );
$$;

create or replace function public.owns_site(site_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sites s
    join public.profiles p on p.id = s.owner_profile_id
    where s.id = site_uuid and p.user_id = auth.uid()
  );
$$;

create policy "select own profile or agency reads all"
  on public.profiles for select
  using (auth.uid() = user_id or public.is_agency());

create policy "select owned or agency sites"
  on public.sites for select
  using (public.is_agency() or public.owns_site(id));

create policy "select versions of owned or agency sites"
  on public.site_versions for select
  using (public.is_agency() or public.owns_site(site_id));
