-- EVENT SUPPLIERS - GitHub Assets compatibility fix
-- Safe to run more than once.

alter table public.suppliers
  add column if not exists asset_folder text,
  add column if not exists cover_image text default 'cover.jpg',
  add column if not exists logo_image text default 'logo.png';

-- Existing supplier rows get a blank folder until Admin sets one.
update public.suppliers
set cover_image = coalesce(nullif(cover_image,''), 'cover.jpg'),
    logo_image  = coalesce(nullif(logo_image,''), 'logo.png');

-- Ensure the gallery fields expected by the frontend exist.
alter table public.supplier_gallery
  add column if not exists image_url text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

-- Refresh PostgREST schema cache after structural changes.
notify pgrst, 'reload schema';
