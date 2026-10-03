export const audioTypes: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac",
};
export const coverTypes: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminTrack = {
  id: string; kind: "beats" | "loops"; title: string; bpm: number; duration_seconds: number | null;
  genre: string; musical_key: string; description: string; moods: string[]; tags: string[]; notes: string[];
  preview_path: string; cover_path: string | null; published: boolean;
};

export function bpmFromFilename(filename: string): number | null {
  const matches = [...filename.matchAll(/(?:^|[^\d.])(\d{1,3})[\s_-]*bpm(?=$|[^a-z0-9])/gi)];
  const values = new Set(matches.map(match => Number(match[1])).filter(bpm => bpm >= 1 && bpm <= 400));
  return values.size === 1 ? [...values][0] : null;
}
