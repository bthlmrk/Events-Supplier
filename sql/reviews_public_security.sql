-- Event Suppliers: secure public review flow
-- Public users can read APPROVED reviews and submit PENDING reviews only.
-- Admins can read all reviews and update/delete them.

alter table public.reviews enable row level security;

-- Remove every existing policy on reviews so older broad policies cannot conflict.
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'reviews'
  loop
    execute format('drop policy if exists %I on public.reviews', r.policyname);
  end loop;
end $$;

create policy "reviews_public_read_approved"
on public.reviews
for select
to anon
using (status = 'approved');

create policy "reviews_authenticated_read"
on public.reviews
for select
to authenticated
using (status = 'approved' or public.is_admin());

create policy "reviews_public_insert_pending"
on public.reviews
for insert
to anon, authenticated
with check (status = 'pending');

create policy "reviews_admin_update"
on public.reviews
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "reviews_admin_delete"
on public.reviews
for delete
to authenticated
using (public.is_admin());

grant select, insert on public.reviews to anon;
grant select, insert, update, delete on public.reviews to authenticated;
