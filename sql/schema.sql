-- Event Suppliers starter schema for Supabase
create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  description text,
  address text,
  city text,
  province text,
  latitude double precision,
  longitude double precision,
  contact_number text,
  facebook_url text,
  messenger_url text,
  asset_folder text,
  cover_image text default 'cover.jpg',
  logo_image text default 'logo.png',
  is_featured boolean not null default false,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_categories (
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (supplier_id, category_id)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_services (
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (supplier_id, service_id)
);

create table if not exists public.supplier_service_areas (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  province text,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_gallery (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','hidden')),
  created_at timestamptz not null default now()
);

-- Public can read active suppliers/categories/services and approved reviews.
alter table public.suppliers enable row level security;
alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.supplier_categories enable row level security;
alter table public.supplier_services enable row level security;
alter table public.supplier_service_areas enable row level security;
alter table public.supplier_gallery enable row level security;
alter table public.reviews enable row level security;

create policy "public read active suppliers" on public.suppliers for select using (is_active = true);
create policy "public read active categories" on public.categories for select using (is_active = true);
create policy "public read active services" on public.services for select using (is_active = true);
create policy "public read supplier categories" on public.supplier_categories for select using (true);
create policy "public read supplier services" on public.supplier_services for select using (true);
create policy "public read service areas" on public.supplier_service_areas for select using (true);
create policy "public read gallery" on public.supplier_gallery for select using (true);
create policy "public read approved reviews" on public.reviews for select using (status = 'approved');
create policy "public insert pending reviews" on public.reviews for insert with check (status = 'pending');

-- IMPORTANT: Admin write policies are intentionally not opened here.
-- Add authenticated admin-only policies after creating your admin role/profile table.

insert into public.categories (name,slug) values
('Photobooth','photobooth'),
('Lights & Sounds','lights-sounds'),
('Food Catering','food-catering'),
('Coffee Booth','coffee-booth'),
('Mobile Bar','mobile-bar'),
('Event Styling','event-styling'),
('Photo & Video','photo-video'),
('Host / Emcee','host-emcee')
on conflict (name) do nothing;
