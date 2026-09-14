-- Event Suppliers: pure Supabase admin security + CRUD policies
-- Run this AFTER schema.sql.
-- Then create an admin user in Supabase Authentication and insert that user's UUID
-- into public.admin_users using the final INSERT example at the bottom.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin can read own admin row" on public.admin_users;
create policy "admin can read own admin row"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Ensure updated_at exists for supplier updates.
alter table public.suppliers add column if not exists updated_at timestamptz not null default now();

-- ADMIN POLICIES ---------------------------------------------------------
-- Suppliers
DROP POLICY IF EXISTS "admin read all suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "admin insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "admin update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "admin delete suppliers" ON public.suppliers;
CREATE POLICY "admin read all suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.is_admin());

-- Categories
DROP POLICY IF EXISTS "admin read all categories" ON public.categories;
DROP POLICY IF EXISTS "admin insert categories" ON public.categories;
DROP POLICY IF EXISTS "admin update categories" ON public.categories;
DROP POLICY IF EXISTS "admin delete categories" ON public.categories;
CREATE POLICY "admin read all categories" ON public.categories FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin update categories" ON public.categories FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin delete categories" ON public.categories FOR DELETE TO authenticated USING (public.is_admin());

-- Services
DROP POLICY IF EXISTS "admin read all services" ON public.services;
DROP POLICY IF EXISTS "admin insert services" ON public.services;
DROP POLICY IF EXISTS "admin update services" ON public.services;
DROP POLICY IF EXISTS "admin delete services" ON public.services;
CREATE POLICY "admin read all services" ON public.services FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin insert services" ON public.services FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin update services" ON public.services FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin delete services" ON public.services FOR DELETE TO authenticated USING (public.is_admin());

-- Supplier/category links
DROP POLICY IF EXISTS "admin write supplier categories insert" ON public.supplier_categories;
DROP POLICY IF EXISTS "admin write supplier categories delete" ON public.supplier_categories;
CREATE POLICY "admin write supplier categories insert" ON public.supplier_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin write supplier categories delete" ON public.supplier_categories FOR DELETE TO authenticated USING (public.is_admin());

-- Supplier/service links
DROP POLICY IF EXISTS "admin write supplier services insert" ON public.supplier_services;
DROP POLICY IF EXISTS "admin write supplier services delete" ON public.supplier_services;
CREATE POLICY "admin write supplier services insert" ON public.supplier_services FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin write supplier services delete" ON public.supplier_services FOR DELETE TO authenticated USING (public.is_admin());

-- Service areas
DROP POLICY IF EXISTS "admin manage service areas select" ON public.supplier_service_areas;
DROP POLICY IF EXISTS "admin manage service areas insert" ON public.supplier_service_areas;
DROP POLICY IF EXISTS "admin manage service areas update" ON public.supplier_service_areas;
DROP POLICY IF EXISTS "admin manage service areas delete" ON public.supplier_service_areas;
CREATE POLICY "admin manage service areas select" ON public.supplier_service_areas FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin manage service areas insert" ON public.supplier_service_areas FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin manage service areas update" ON public.supplier_service_areas FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin manage service areas delete" ON public.supplier_service_areas FOR DELETE TO authenticated USING (public.is_admin());

-- Gallery
DROP POLICY IF EXISTS "admin manage gallery select" ON public.supplier_gallery;
DROP POLICY IF EXISTS "admin manage gallery insert" ON public.supplier_gallery;
DROP POLICY IF EXISTS "admin manage gallery update" ON public.supplier_gallery;
DROP POLICY IF EXISTS "admin manage gallery delete" ON public.supplier_gallery;
CREATE POLICY "admin manage gallery select" ON public.supplier_gallery FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin manage gallery insert" ON public.supplier_gallery FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin manage gallery update" ON public.supplier_gallery FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin manage gallery delete" ON public.supplier_gallery FOR DELETE TO authenticated USING (public.is_admin());

-- Reviews: admin can read all, moderate, and permanently delete.
DROP POLICY IF EXISTS "admin read all reviews" ON public.reviews;
DROP POLICY IF EXISTS "admin update reviews" ON public.reviews;
DROP POLICY IF EXISTS "admin delete reviews" ON public.reviews;
CREATE POLICY "admin read all reviews" ON public.reviews FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin update reviews" ON public.reviews FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin delete reviews" ON public.reviews FOR DELETE TO authenticated USING (public.is_admin());

-- IMPORTANT SETUP STEP:
-- 1) Supabase Dashboard > Authentication > Users > create your admin account.
-- 2) Copy that user's UUID.
-- 3) Run this, replacing the UUID:
-- insert into public.admin_users (user_id) values ('PASTE-AUTH-USER-UUID-HERE') on conflict do nothing;
