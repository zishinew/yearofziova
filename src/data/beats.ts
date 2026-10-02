export type Beat = {
  id: string;
  title: string;
  genre?: string;
  bpm: number;
  key?: string;
  audioUrl?: string;
  coverArt?: string;
  durationSeconds?: number;
  description?: string;
  moods?: string[];
  tags?: string[];
  notes?: string[];
  purchaseUrl?: string;
};

// Add released beats here when their previews and licensing details are ready.
export const beats: Beat[] = [];

export const loops: Beat[] = [];
export const BEAT_PRICE_CAD = 24.99;
