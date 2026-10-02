# Year of Ziova

Ziova's minimalist beat store, built with Next.js App Router, React, TypeScript, and Tailwind CSS v4. The landing page contains only Beat Vault and Loop Kit; each opens its own catalog, with a Back button to return.

## Development

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Beats and loops

Add audio previews under `public/audio/`, then add entries to the `beats` or `loops` arrays in `src/data/beats.ts`. Each entry needs a unique `id`, `title`, `genre` (`Trap`, `R&B`, or `Experimental`), `bpm`, `key`, and `audioUrl` (for example `/audio/track.mp3`).

Every beat is $24.99 CAD. Loop pricing is handled by inquiry. Preview buttons play the supplied audio; only one preview plays at a time across the site. Licensing and purchase inquiries link to Instagram @yearofziova. An optional `purchaseUrl` can be added when a real checkout link is available.

The catalogs show a coming-soon state until tracks are added. No demo tracks or checkout are presented as real inventory.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
```
