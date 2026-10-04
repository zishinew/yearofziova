type Relation<T> = T | T[] | null;
type DownloadProduct = {
  id: string;
  title: string;
  bpm: number | null;
  lease: string | null;
  catalog_track_id: string | null;
  catalog_tracks: Relation<{ cover_path: string | null }>;
};
type Purchase = { id: string; download_products: Relation<DownloadProduct> };
type LibraryEntry = {
  id: string;
  title: string;
  bpm: number | null;
  coverPath: string | null;
  downloads: { purchaseId: string; lease: string | null }[];
};

function first<T>(relation: Relation<T>): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

// Purchases arrive newest first. Keep one paid grant per format and group by
// catalog identity, so unrelated tracks with the same title stay separate.
export function groupDownloads(purchases: Purchase[]): LibraryEntry[] {
  const entries = new Map<string, LibraryEntry>();
  for (const purchase of purchases) {
    const product = first(purchase.download_products);
    if (!product) continue;
    const id = product.catalog_track_id ? `track:${product.catalog_track_id}` : `product:${product.id}`;
    let entry = entries.get(id);
    if (!entry) {
      entry = {
        id, title: product.title, bpm: product.bpm,
        coverPath: first(product.catalog_tracks)?.cover_path ?? null,
        downloads: [],
      };
      entries.set(id, entry);
    }
    if (!entry.downloads.some(download => download.lease === product.lease)) {
      entry.downloads.push({ purchaseId: purchase.id, lease: product.lease });
    }
  }
  for (const entry of entries.values()) {
    const rank = (lease: string | null) => lease === "mp3" ? 0 : lease === "wav" ? 1 : 2;
    entry.downloads.sort((a, b) => rank(a.lease) - rank(b.lease));
  }
  return [...entries.values()];
}
