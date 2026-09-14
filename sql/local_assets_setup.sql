-- EVENT SUPPLIERS - GitHub/local assets image setup
-- Run this ONCE on an existing Supabase project.

alter table public.suppliers
  add column if not exists asset_folder text,
  add column if not exists cover_image text default 'cover.jpg',
  add column if not exists logo_image text default 'logo.png';

comment on column public.suppliers.asset_folder is
'GitHub assets subfolder under assets/suppliers/, e.g. justshootme-photobooth';
comment on column public.suppliers.cover_image is
'Cover image filename inside the supplier asset folder, e.g. cover.jpg';
comment on column public.suppliers.logo_image is
'Logo filename inside the supplier asset folder, e.g. logo.png';
comment on column public.supplier_gallery.image_url is
'For this build, store an image filename such as gallery-01.jpg. Legacy full URLs/paths are still supported by the frontend.';

-- Optional examples for existing suppliers. Edit names/folders if needed.
update public.suppliers
set asset_folder = 'justshootme-photobooth'
where lower(business_name) = lower('JustShootMe Photobooth')
  and (asset_folder is null or asset_folder = '');

update public.suppliers
set asset_folder = 'njs-mobile-lights-and-sounds'
where lower(business_name) in (lower('NJ''s Mobile Lights and Sounds'), lower('NJs Mobile Lights and Sounds'))
  and (asset_folder is null or asset_folder = '');
