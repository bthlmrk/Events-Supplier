-- EVENT SUPPLIERS: allow Supplier Systems inquiries in Contact Tickets
-- Run once in Supabase SQL Editor.

alter table public.contact_tickets
  drop constraint if exists contact_tickets_request_type_check;

alter table public.contact_tickets
  add constraint contact_tickets_request_type_check
  check (request_type in ('update_business','add_business','featured_subscription','supplier_system','other'));
