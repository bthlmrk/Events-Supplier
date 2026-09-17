# Event Suppliers — Pure Supabase Build

This build does not use localStorage for suppliers, categories, services, or reviews.

## Setup
1. Put your Supabase Project URL and publishable/anon key in `js/config.js`.
2. In Supabase SQL Editor, run `sql/schema.sql` once if you have not already done so.
3. Then run `sql/admin_pure_supabase.sql`.
4. In Supabase Dashboard > Authentication > Users, create the admin email/password account.
5. Copy the Auth user UUID and run:

```sql
insert into public.admin_users (user_id)
values ('PASTE-AUTH-USER-UUID-HERE')
on conflict do nothing;
```

6. Open `admin/index.html` and sign in with that admin account.

## Included now
- Public supplier list reads from Supabase only.
- Admin supplier Add/Edit/Delete writes directly to Supabase.
- Categories Add/Delete are Supabase-backed.
- Services/Tags Add/Delete are Supabase-backed.
- Reviews can be approved, hidden, or permanently deleted by Admin.
- Supplier deletion cascades to linked categories/services, gallery, service areas, and reviews because of foreign-key `on delete cascade` rules.
- No supplier/demo data is loaded from localStorage.

## Security
Do not put the Supabase `service_role` key in browser code. The browser uses only the publishable/anon key; destructive admin actions are protected by Supabase Auth + RLS policies checking `admin_users`.

## Admin improvements in this build

- Supplier latitude/longitude no longer needs manual typing. In Add/Edit Supplier, use the OpenStreetMap picker: search the typed address, click anywhere on the map, drag the marker, or use the admin device location. The latitude/longitude fields are filled automatically.
- Supplier Services / Tags now uses a searchable multi-select dropdown sourced only from the Supabase `services` table. Add available tags in the Services / Tags admin page, then select them on a supplier.
- Added missing admin pages for `supplier_service_areas` and `supplier_gallery`, with Supabase-only add/delete management.
- No localStorage supplier data is used.

## Public Reviews
This build includes a public **Leave a Review** modal on every supplier card. Reviews are saved directly to Supabase with `status = pending` and become public only after an Admin approves them in **Admin > Reviews**.

After updating from an older build, run `sql/reviews_public_security.sql` in the Supabase SQL Editor once. This replaces older broad review policies with the secure flow: public users can read approved reviews and submit pending reviews only; Admin can view/moderate/delete all reviews.


## GitHub supplier image folders (no Supabase Storage)

This build now keeps actual supplier photos in the repository under `assets/suppliers/`.

1. Run `sql/local_assets_setup.sql` once on an existing database.
2. In Admin -> Suppliers, set **Business Folder**, **Cover Image Filename**, and optional **Logo Filename**.
3. Create the same folder in the repository, e.g. `assets/suppliers/justshootme-photobooth/`.
4. Put `cover.jpg`, `logo.png`, and gallery files inside it.
5. Admin -> Gallery stores only a filename such as `gallery-01.jpg`; it does not upload files to Supabase.
6. Commit/push the new image files to GitHub. GitHub Pages will serve them automatically after deployment.

The browser cannot write files directly into your GitHub repository, so the Admin panel manages paths/filenames while GitHub manages the actual image files.

## Fix for 400 errors after enabling GitHub asset folders
If the browser console shows HTTP 400 requests mentioning `asset_folder`, run `sql/github_assets_compatibility_fix.sql` once in the Supabase SQL Editor, then hard-refresh the site (Ctrl+F5). The Admin build no longer requests `asset_folder` inside embedded relationship queries, making it more tolerant during migration.

The Leaflet CDN tags also no longer use a fixed Subresource Integrity hash, which avoids the `Failed to find a valid digest in the integrity attribute` error seen with some CDN responses.


## Featured subscriptions + Contact Tickets
Run `sql/featured_and_contact_tickets.sql` once after upgrading. The Admin Suppliers form supports 1-day, 3-day, 7-day, and Lifetime featured plans. Public Contact Us tickets are stored in Supabase and managed from Admin > Contact Tickets. Configure the owner/admin Messenger URL under Admin > Settings.


## Multi-platform supplier contacts
Run `sql/supplier_contacts.sql` once in Supabase SQL Editor. Admin can then add multiple contact methods per supplier (Facebook, Messenger, Mobile, Viber, WeChat, WhatsApp, Telegram, Email, Website, or Custom). All active contact methods appear in the public View Supplier modal.


## Contact Ticket → Supplier Acceptance
Incoming contact tickets start as **Pending**. Admin can use **Accept & Add Supplier** on a pending ticket to open the existing Add Supplier modal prefilled with the ticket's submitted name, business name, email, contact number, and message (message becomes the supplier description). The Admin can edit the prefilled information, add category/services/location/assets, then save the supplier. After a successful supplier save, the ticket is automatically marked Resolved.

Run `sql/contact_ticket_accept_supplier.sql` once in Supabase SQL Editor to add the supplier `contact_person` and `email` fields used by the acceptance workflow.
