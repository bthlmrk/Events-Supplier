-- EVENT SUPPLIERS: Add dedicated fields for "Add My Business" contact tickets.
-- Run once in Supabase SQL Editor.
-- contact_number is already part of the base contact_tickets schema and is used by Add My Business.

alter table public.contact_tickets add column if not exists contact_person text;
alter table public.contact_tickets add column if not exists category text;
alter table public.contact_tickets add column if not exists address text;
alter table public.contact_tickets add column if not exists city text;
alter table public.contact_tickets add column if not exists province text;

notify pgrst, 'reload schema';
