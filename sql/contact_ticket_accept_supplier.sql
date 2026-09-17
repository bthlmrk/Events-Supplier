-- EVENT SUPPLIERS: Contact Ticket -> Supplier acceptance support
-- Run once in Supabase SQL Editor.

alter table public.suppliers add column if not exists contact_person text;
alter table public.suppliers add column if not exists email text;

notify pgrst, 'reload schema';
