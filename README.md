# Year of Ziova

Ziova's minimalist beat store, built with Next.js App Router, React, TypeScript, and Tailwind CSS v4. The landing page has Beat Vault and Loop Kit beneath the centered eye header. Both open minimalist playlists with cover art, title, BPM, and duration. Use Back or the eye to return home.

## Development

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Beats and loops

Sign in with your admin account, open **Account → Admin dashboard** (or `/admin`), and choose **Beats** or **Loops**. Upload a public preview and optional cover art, enter the title/BPM/details, and save. Duration is detected from the preview when possible, or can be entered in seconds. Published tracks appear in the corresponding playlist immediately; uncheck Publish to save a draft. Existing tracks can be edited, hidden, or published from the dashboard.

Previews accept MP3/WAV/OGG/M4A/FLAC up to 50 MB; covers accept JPG/PNG/WEBP up to 5 MB. The optional purchased download accepts audio or ZIP up to 50 MB and stays in private storage. These limits match the configured buckets. Full paid audio should go in Purchased download, with a shortened or tagged sample in Preview audio. Replacing files uses a new path and leaves older referenced versions intact; failed uploads are cleaned up only when no catalog or download record references them.

Add audio previews under `public/audio/` and covers under `public/covers/`, then add entries to the `beats` or `loops` arrays in `src/data/beats.ts`. Each entry needs a unique `id`, `title`, and `bpm`. Optional fields are `coverArt` (image path), `durationSeconds` (number of seconds), `audioUrl`, `genre`, `key`, `description`, `moods` (string array), `tags` (string array), and `notes` (string array).

Rows expand on mouse hover. Clicking, tapping, or pressing Enter/Space pins the details open; repeat to close. Details show the supplied description, moods, tags, notes, genre/key, and audio player. Only one audio preview plays at a time. Missing artwork uses a neutral placeholder and missing durations display a dash.

MP3 leases are $24.99 CAD; WAV leases are $34.99 CAD. The cart uses Stripe-hosted Checkout. Exclusive leases and loop pricing are handled through Instagram @yearofziova.

The catalogs show a coming-soon state until tracks are added. A lease can only be purchased after its matching private file is uploaded.

## Customer accounts and redownloads

The header Account link opens email/password sign-in and signup in a card over the blurred current screen. Signup and password recovery switch inside the card. Escape, the close button, or the backdrop dismiss it and preserve the selected playlist. Direct `/login` and `/login/reset` links also show the card over the landing background. Signed-in customers continue to My Downloads to redownload purchased beats without looking up an order email. Signup may require a one-time email confirmation. The whole site uses the landing page's Courier monospace font.

### Backend setup

1. The dedicated backend is the **beat store** project in the **yearofziova** organization: https://supabase.com/dashboard/project/nysxznkabusqmthihlpt. Its purchase schema and private bucket are already applied.
2. Copy `.env.example` to `.env.local`. For local development, override `SITE_URL=http://localhost:3000`. In your hosting provider, set all three environment variables from `.env.example`, with `SITE_URL=https://yearofziova.com`, and redeploy. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable.
3. For a fresh replacement project, apply all files in `supabase/migrations/` in timestamp order, or link the Supabase CLI and push the migrations. The migrations configure customer downloads, restrict a default internal function, and add the admin catalog and upload policies.
4. In [Supabase Auth URL configuration](https://supabase.com/dashboard/project/nysxznkabusqmthihlpt/auth/url-configuration), set **Site URL** to `https://yearofziova.com`. Add these **Redirect URLs**:
   - `https://yearofziova.com/auth/callback?next=/account`
   - `https://yearofziova.com/auth/callback?next=/account/password`
   - `http://localhost:3000/auth/callback?next=/account`
   - `http://localhost:3000/auth/callback?next=/account/password`

   Keep email confirmation enabled. Configure production SMTP for signup and recovery delivery; default Supabase email delivery is restricted. The dashboard URL settings and SMTP require separate configuration; updating this repository does not apply them remotely.
5. Upload full paid deliverables to the **private** `purchased-beats` Storage bucket. Do not put full deliverables in `public/`; that folder is publicly accessible. Public preview audio can stay there.
6. Register each deliverable in `download_products` with its catalog ID, title, BPM, private Storage path, and download filename.
7. After verifying payment, add a `purchases` record for the customer's Supabase Auth user ID and product ID. Set `source` and `order_reference` to your payment/order reference. For existing Instagram orders, verify the purchase before assigning it to the customer's confirmed account. Mark refunds `refunded` to remove future download access.

The dashboard registers separate MP3 and WAV products as `<track UUID>:mp3` and `<track UUID>:wav`; old manual products retain their IDs. Customer purchase grants require verified payment; uploading/publishing a track does not create purchase access.

### Admin permissions

Admin membership lives in `admin_users`, linked to a confirmed Auth user ID. Customers can read only their own membership and cannot create or edit roles. The server checks verified identity and membership for every dashboard action, and Storage/RLS enforce the same membership for direct API access. Grant or revoke roles only through the owner-controlled Supabase SQL editor. No extra deployment environment variables or service-role key are required.

The latest security check has no catalog/RLS warnings. Supabase separately flags [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); this Auth setting is managed in Supabase, not by these migrations.

Example for the owner to run in the Supabase SQL editor after uploading a real file and verifying a real order:

```sql
insert into public.download_products (id, title, bpm, storage_path, download_name)
values ('YOUR_CATALOG_ID', 'YOUR_BEAT_TITLE', 140, 'YOUR_PRIVATE_FILE_PATH', 'beat.wav');

insert into public.purchases (user_id, product_id, source, order_reference)
values ('CONFIRMED_CUSTOMER_AUTH_UUID', 'YOUR_CATALOG_ID', 'instagram', 'YOUR_VERIFIED_ORDER_REFERENCE');
```

Purchase grants are created by the signature-verified Stripe webhook, never by the browser or a checkout success URL. The library reads verified grants; login alone does not unlock anything. See [STRIPE_SETUP.md](STRIPE_SETUP.md) for credentials, sandbox testing and deployment setup.

The app uses cookie sessions, server-verified identity, row-level security, and 60-second signed download links. Customers cannot grant themselves purchases, read another customer's purchases, upload files, or download unowned/refunded deliverables. An already-issued signed link remains valid until it expires.

Without backend credentials, account submission is disabled and displays a coming-soon state. Do not advertise live accounts until the backend is configured and signup, login, and a real purchase download have been tested.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm test
```
