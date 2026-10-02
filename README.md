# Year of Ziova

Ziova's minimalist beat store, built with Next.js App Router, React, TypeScript, and Tailwind CSS v4. The landing page has Beat Vault and Loop Kit beneath the centered eye header. Both open minimalist playlists with cover art, title, BPM, and duration. Use Back or the eye to return home.

## Development

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Beats and loops

Add audio previews under `public/audio/` and covers under `public/covers/`, then add entries to the `beats` or `loops` arrays in `src/data/beats.ts`. Each entry needs a unique `id`, `title`, and `bpm`. Optional fields are `coverArt` (image path), `durationSeconds` (number of seconds), `audioUrl`, `genre`, `key`, `description`, `moods` (string array), `tags` (string array), and `notes` (string array).

Rows expand on mouse hover. Clicking, tapping, or pressing Enter/Space pins the details open; repeat to close. Details show the supplied description, moods, tags, notes, genre/key, and audio player. Only one audio preview plays at a time. Missing artwork uses a neutral placeholder and missing durations display a dash.

Every beat is $24.99 CAD, shown inside its expanded details. Loop pricing is handled by inquiry. Licensing and purchase inquiries link to Instagram @yearofziova. An optional `purchaseUrl` can link to a real checkout when available.

The catalogs show a coming-soon state until tracks are added. No demo tracks or checkout are presented as real inventory.

## Customer accounts and redownloads

The header Account link opens email/password sign-in and signup. Customers use My Downloads to redownload purchased beats without looking up an order email. Signup may require a one-time email confirmation. Password recovery is available at `/login/reset`.

### Backend setup

1. The dedicated backend is the **beat store** project in the **yearofziova** organization: https://supabase.com/dashboard/project/nysxznkabusqmthihlpt. Its purchase schema and private bucket are already applied.
2. Copy `.env.example` to `.env.local` and set the project URL and publishable key. Set `SITE_URL` to the deployed site origin (or `http://localhost:3000` locally). Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable.
3. For a fresh replacement project, apply both files in `supabase/migrations/` in timestamp order, or link the Supabase CLI and push the migrations. The second migration restricts a default internal Supabase function when present.
4. In Supabase Auth URL configuration, set the site URL and allow the local and deployed `/auth/callback` URLs, including `/auth/callback?next=/account` and `/auth/callback?next=/account/password`. Keep email confirmation enabled. Configure production SMTP for signup and recovery delivery; default Supabase email delivery is restricted.
5. Upload full paid deliverables to the **private** `purchased-beats` Storage bucket. Do not put full deliverables in `public/`; that folder is publicly accessible. Public preview audio can stay there.
6. Register each deliverable in `download_products` with its catalog ID, title, BPM, private Storage path, and download filename.
7. After verifying payment, add a `purchases` record for the customer's Supabase Auth user ID and product ID. Set `source` and `order_reference` to your payment/order reference. For existing Instagram orders, verify the purchase before assigning it to the customer's confirmed account. Mark refunds `refunded` to remove future download access.

Example for the owner to run in the Supabase SQL editor after uploading a real file and verifying a real order:

```sql
insert into public.download_products (id, title, bpm, storage_path, download_name)
values ('YOUR_CATALOG_ID', 'YOUR_BEAT_TITLE', 140, 'YOUR_PRIVATE_FILE_PATH', 'beat.wav');

insert into public.purchases (user_id, product_id, source, order_reference)
values ('CONFIRMED_CUSTOMER_AUTH_UUID', 'YOUR_CATALOG_ID', 'instagram', 'YOUR_VERIFIED_ORDER_REFERENCE');
```

Purchase grants must be created by the owner or a trusted payment webhook, never by the browser or a checkout success URL. There is no checkout/payment webhook yet because a payment provider has not been configured. The library reads verified grants; login alone does not unlock anything.

The app uses cookie sessions, server-verified identity, row-level security, and 60-second signed download links. Customers cannot grant themselves purchases, read another customer's purchases, upload files, or download unowned/refunded deliverables. An already-issued signed link remains valid until it expires.

Without backend credentials, account submission is disabled and displays a coming-soon state. Do not advertise live accounts until the backend is configured and signup, login, and a real purchase download have been tested.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm test
```
