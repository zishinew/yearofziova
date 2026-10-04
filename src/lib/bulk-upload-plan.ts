import { audioTypes, coverTypes, metadataFromFilename } from "@/lib/track-upload";

export type BulkFile = { name: string; webkitRelativePath: string; size: number };
export function planBulkUpload<T extends BulkFile>(files: T[], kind: "beats" | "loops") {
  const path = (file: T) => file.webkitRelativePath || file.name;
  const folder = (file: T) => path(file).slice(0, path(file).lastIndexOf("/") + 1);
  const stem = (file: T) => file.name.replace(/\.[^.]+$/, "").toLowerCase();
  const ext = (file: T) => file.name.split(".").pop()?.toLowerCase() || "";
  const visible = files.filter(file => !path(file).split("/").some(part => part.startsWith(".") || part === "__MACOSX"));
  const images = visible.filter(file => coverTypes[ext(file)]);
  const audio = visible.filter(file => audioTypes[ext(file)]);
  const archives = kind === "loops" ? visible.filter(file => ext(file) === "zip") : [];
  const previews = new Set<T>();
  const zipPreviews = new Map<T, T>();
  for (const zip of archives) {
    const candidates = audio.filter(file => folder(file) === folder(zip) && [stem(zip), `${stem(zip)}-preview`, `${stem(zip)}_preview`, `${stem(zip)} preview`].includes(stem(file)));
    if (candidates.length === 1) { zipPreviews.set(zip, candidates[0]); previews.add(candidates[0]); }
  }
  const sources = kind === "beats" ? audio.filter(file => ext(file) === "wav") : [...archives, ...audio.filter(file => !previews.has(file))];
  return sources.sort((a, b) => path(a).localeCompare(path(b))).map(file => {
    const nearby = images.filter(image => folder(image) === folder(file));
    const exact = nearby.filter(image => stem(image) === stem(file));
    const named = nearby.filter(image => ["cover", "artwork", "folder"].includes(stem(image)));
    const cover = kind === "loops" ? null : exact.length === 1 ? exact[0] : named.length === 1 ? named[0] : nearby.length === 1 ? nearby[0] : null;
    const metadata = metadataFromFilename(file.name);
    return { file, cover, preview: kind === "beats" ? null : ext(file) === "zip" ? zipPreviews.get(file) || null : file, title: metadata.title.slice(0, 120) || "Untitled", bpm: metadata.bpm, notes: metadata.notes };
  });
}
