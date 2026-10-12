// One-time migration for full-length public playback assets. Originals stay private.
// Run with local server credentials: node --env-file=.env.local scripts/restore-beat-previews.mjs --apply
import { createClient } from "@supabase/supabase-js";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const apply = process.argv.includes("--apply");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
function checked(result) { if (result.error) throw new Error(result.error.message); return result.data; }
const tracks = checked(await db.from("catalog_tracks").select("id,title,bpm,preview_path,preview_start_seconds").eq("kind", "beats").is("deleted_at", null));
for (const track of tracks) {
  const dir = await mkdtemp(join(tmpdir(), "ziova-preview-"));
  try {
    const products = checked(await db.from("download_products").select("lease,storage_path").eq("catalog_track_id", track.id));
    const wav = products.find(product => product.lease === "wav");
    const sourcePath = wav?.storage_path || track.preview_path;
    const bucket = wav ? "purchased-beats" : "track-previews";
    const blob = checked(await db.storage.from(bucket).download(sourcePath));
    const original = join(dir, "original");
    await writeFile(original, Buffer.from(await blob.arrayBuffer()));
    const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", original], { encoding: "utf8" }).trim());
    if (!Number.isFinite(seconds)) throw new Error("Couldn't read source duration.");
    console.log(`${track.title}: ${seconds.toFixed(1)} seconds → preview at ${Number(track.preview_start_seconds)} seconds${apply ? "" : " (dry run)"}`);
    if (!apply) continue;
    // Legacy WAV playback uploads had no private leases. Preserve the original before replacing playback.
    if (!wav) {
      if (!/\.wav$/i.test(sourcePath)) throw new Error("Upload an original WAV before migrating this legacy beat.");
      for (const lease of ["wav", "mp3"]) {
        if (products.some(product => product.lease === lease)) continue;
        const path = `${track.id}/${crypto.randomUUID()}.${lease}`;
        let bytes = await readFile(original);
        if (lease === "mp3") {
          const fullMp3 = join(dir, "full.mp3");
          execFileSync("ffmpeg", ["-v", "error", "-i", original, "-vn", "-c:a", "libmp3lame", "-b:a", "320k", fullMp3]);
          bytes = await readFile(fullMp3);
        }
        checked(await db.storage.from("purchased-beats").upload(path, bytes, { contentType: lease === "wav" ? "audio/wav" : "audio/mpeg" }));
        checked(await db.from("download_products").insert({ id: `${track.id}:${lease}`, catalog_track_id: track.id, lease, title: track.title, bpm: track.bpm, storage_path: path, download_name: `${track.title.replace(/[^\w. ()-]/g, "_")}.${lease}` }));
      }
    }
    const previewFile = join(dir, "preview.mp3");
    execFileSync("ffmpeg", ["-v", "error", "-ss", String(Number(track.preview_start_seconds)), "-i", original, "-t", "30", "-vn", "-c:a", "libmp3lame", "-b:a", "320k", previewFile]);
    const path = `${track.id}/${crypto.randomUUID()}.mp3`;
    checked(await db.storage.from("track-previews").upload(path, await readFile(previewFile), { contentType: "audio/mpeg" }));
    const saved = checked(await db.from("catalog_tracks").update({ preview_path: path }).eq("id", track.id).eq("preview_path", track.preview_path).select("id"));
    if (!saved.length) { checked(await db.storage.from("track-previews").remove([path])); throw new Error("Track changed during migration; retry with current metadata."); }
    // Keep old full public versions as private backups and remove their public copies.
    const backupPath = `${track.id}/${crypto.randomUUID()}.${track.preview_path.split(".").pop()}`;
    const old = checked(await db.storage.from("track-previews").download(track.preview_path));
    checked(await db.storage.from("purchased-beats").upload(backupPath, old, { contentType: old.type || "audio/mpeg" }));
    checked(await db.storage.from("track-previews").remove([track.preview_path]));
    console.log(`${track.title}: preview saved; complete downloads retained privately.`);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
