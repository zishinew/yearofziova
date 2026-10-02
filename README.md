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

## Checks

```sh
npm run lint
npm run typecheck
npm run build
```
