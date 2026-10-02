export type Beat = {
  id: string;
  title: string;
  genre: "Trap" | "R&B" | "Experimental";
  bpm: number;
  key: string;
  audioUrl: string;
  purchaseUrl?: string;
};

// Add released beats here when their previews and licensing details are ready.
export const beats: Beat[] = [];

export const loops: Beat[] = [];
export const BEAT_PRICE_CAD = 24.99;
