-- EVENT SUPPLIERS: Featured subscriptions + Contact Tickets
-- Run once in Supabase SQL Editor.

alter table public.suppliers add column if not exists featured_plan text not null default 'none';
alter table public.suppliers add column if not exists featured_started_at timestamptz;
alter table public.suppliers add column if not exists featured_until timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='suppliers_featured_plan_check') then
    alter table public.suppliers add constraint suppliers_featured_plan_check check (featured_plan in ('none','1_day','3_days','7_days','lifetime'));
  end if;
end $$;

-- Preserve any old Featured=true records as Lifetime so they do not disappear unexpectedly.
update public.suppliers set featured_plan='lifetime', featured_started_at=coalesce(featured_started_at,updated_at,created_at,now()) where is_featured=true and (featured_plan is null or featured_plan='none');

create table if not exists public.contact_tickets (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('update_business','add_business','featured_subscription','other')),
  name text not null,
  business_name text,
  email text,
  contact_number text,
  message text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_tickets enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='contact_tickets' loop
    execute format('drop policy if exists %I on public.contact_tickets',r.policyname);
  end loop;
end $$;

create policy "contact_tickets_public_insert" on public.contact_tickets for insert to anon, authenticated with check (status='pending');
create policy "contact_tickets_admin_select" on public.contact_tickets for select to authenticated using (public.is_admin());
create policy "contact_tickets_admin_update" on public.contact_tickets for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "contact_tickets_admin_delete" on public.contact_tickets for delete to authenticated using (public.is_admin());

grant insert on public.contact_tickets to anon, authenticated;
grant select,update,delete on public.contact_tickets to authenticated;

-- Ensure public can read app settings for the public Messenger link; Admin keeps write control.
alter table public.app_settings enable row level security;
drop policy if exists "app_settings_public_read" on public.app_settings;
create policy "app_settings_public_read" on public.app_settings for select to anon, authenticated using (true);
grant select on public.app_settings to anon, authenticated;

notify pgrst, 'reload schema';
