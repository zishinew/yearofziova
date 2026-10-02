# Year of Ziova

Ziova's minimalist beat store, built with Next.js App Router, React, TypeScript, and Tailwind CSS v4. The landing page has Beat Vault and Loop Kit beneath the centered eye header. Beat Vault is a simple playlist showing names and BPM; Loop Kit opens its own catalog. Use Back or the eye to return home.

## Development

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Beats and loops

Add audio previews under `public/audio/`, then add entries to the `beats` or `loops` arrays in `src/data/beats.ts`. Each entry needs a unique `id`, `title`, `genre` (`Trap`, `R&B`, or `Experimental`), `bpm`, `key`, and `audioUrl` (for example `/audio/track.mp3`).

Every beat is $24.99 CAD. Beat Vault intentionally displays only names and BPM. Loop pricing is handled by inquiry, and loop preview buttons play the supplied audio. Licensing and purchase inquiries link to Instagram @yearofziova. An optional `purchaseUrl` can be added to loop entries when a real checkout link is available.

The catalogs show a coming-soon state until tracks are added. No demo tracks or checkout are presented as real inventory.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
```
