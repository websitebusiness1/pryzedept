# Pryze.dept admin

One admin for many brands. Each brand has its own **separate website**; this app is where the brand manages everything that website shows.
The admin has no storefront of its own: websites are separate projects that read their content from the same Supabase project.

Stack: React + TypeScript (Vite), Tailwind CSS, Supabase (Postgres, Auth, Storage, Row Level Security), Netlify.

## What a brand manages (Dashboard)

| Area | What it does |
| --- | --- |
| Products | Name, description, price, category, sizes/colors/stock, up to 10 photos each with cover and drag-to-reorder, draft or published |
| Orders, Inventory | Order list and detail, order and payment status, stock by size and color |
| Homepage | Sections (hero, promo banner, text, products, collections, lookbook, videos): add, edit, reorder (drag or arrows), show/hide, delete. Product sections can show latest, featured, one category, or hand-picked products |
| Lookbooks | Title, description, collection name, shoot date, many photos, cover, drag-to-reorder, captions and alt text, draft or published |
| Videos | Upload a file (MP4/WebM/MOV, up to 50 MB) or paste a YouTube, Vimeo or direct link; thumbnail; drag-to-reorder; draft or published |
| Media library | All uploaded images and videos: multi-upload, categories, titles and alt text, replace a file, delete unused ones, reorder |
| Fonts | (Pro) Heading, body, navigation and button fonts from a curated Google Fonts list, with a live preview before saving |
| Preview | The brand's real website inside desktop / tablet / mobile frames, including drafts and hidden content |
| Store settings | Logo, banner, contact and social links, shipping, payment methods and instructions |

Owner area (`/owner`): brands, who manages each one, and each brand's **connected website** with a copy-paste connection block.

Images are resized (longest side 2200 px) and compressed in the browser before upload, with no visible loss. GIFs are left untouched.

## Packages and feature control

The owner assigns each brand a package and can switch single features on or off for one brand (Owner area → Packages, and Brands & websites → a brand → Package & features).
Rules are enforced in the database (not just hidden in the UI), and websites are only sent content for features that are switched on.

| | Starter ₱1,500 | Growth ₱2,500 | Pro ₱3,000 |
| --- | --- | --- | --- |
| Products, orders, inventory, preview, store settings | yes | yes | yes |
| Products | 30 | 100 | unlimited |
| Photos per product | 4 | 6 | 10 |
| Homepage sections | 4 | 8 | 20 |
| Lookbooks | off | up to 6 | unlimited |
| Videos | off | up to 6 | unlimited |
| Promo banners | off | yes | yes |
| Custom fonts | off | off | yes |
| Media library | off | off | yes |
| Animated hero video | off | off | yes |

Prices and every limit are editable on the Packages page. Existing brands were moved to Pro; new brands start on Starter. Content for a switched-off feature stays saved but is not shown.
Billing is handled by you directly; nothing is charged automatically.

## Publishing model

- Products, lookbooks, videos and homepage sections each have a **Draft** or **Published** status. Drafts are never sent to the public website.
- The Preview page shows drafts using a short-lived key (valid 4 hours), so unpublished work can be checked on desktop, tablet and mobile.
- **Editing something that is already published changes the live website immediately.** To work privately, set it back to Draft first.
- Fonts apply to the website as soon as they are saved. Use the live preview on the Fonts page before saving.

## Connecting a website

Each website needs these environment variables (shown, ready to copy, on the brand's page in the owner area):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...        (publishable key only)
VITE_STORE_SLUG=<the brand's Store ID>
ADMIN_ORIGIN=<this admin's address>   (Netlify only; lets the admin's Preview display the site)
```

Websites read everything through one database function, `get_site_content(store_slug, preview_key)`, and place orders with `place_order(...)`.
A new website therefore only has to call those two. Without a valid preview key, `get_site_content` returns published content only.

## Run locally

```bash
npm install
cp .env.example .env      # Supabase URL and publishable key
npm run dev
```

## Environment variables

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable key only, never a secret or service-role key),
optional `VITE_PLATFORM_NAME` (default Pryze.dept) and `VITE_CONTACT_EMAIL`, `VITE_CONTACT_PHONE`, `VITE_FACEBOOK_URL`, `VITE_INSTAGRAM_URL` for the landing page.

## Database

`supabase/migrations/` holds the platform migrations (stores, products, orders, RLS, storage, preview keys and the site-content function).
The content tables (`homepage_sections`, `lookbooks`, `lookbook_photos`, `videos`, `media_assets`, `site_settings`) and the `site-media` bucket were
created by two earlier migrations (`cms_content_schema`, `cms_content_policies_and_storage`) that are applied to the project but are not included as files here;
see Supabase > Database > Migrations. Owner account: `supabase/owner-setup.sql`.

Access rules in short: visitors only ever receive published content through `get_site_content`; brand members manage only their own brand and only while it is active;
only the owner can create brands, suspend them, assign members or set a brand's connected website; the preview-key table cannot be read directly by anyone.

## Deploy (Netlify)

The repository root has `netlify.toml` (builds from the `threadspace/` folder). Add the environment variables above in Netlify, deploy, and in Supabase
(Authentication > URL Configuration) set the Site URL to the admin's address.

## Known limits

- Checkout (`place_order`) has no bot protection or rate limiting yet.
- No order or confirmation emails; no "Forgot password" screen yet (reset passwords from the Supabase dashboard).
- Lists load up to 1,000 rows per request; very large catalogs or media libraries need pagination.
- Replacing a media file keeps its address; visitors' browsers may show the old image for up to an hour.
- Video uploads are limited to 50 MB (also bounded by your Supabase plan's per-file limit).
