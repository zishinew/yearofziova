"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { SuccessNotification } from "@/components/success-notification";
import { BulkUpload } from "@/components/bulk-upload";
import { AdminPreview } from "@/components/admin-preview";
import { saveTrack, setTrackPublished, deleteTrack } from "@/app/admin/actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { audioTypes, coverTypes, metadataFromFilename, parseTrackText, type AdminTrack } from "@/lib/track-upload";
import { CoverCropper, croppedCover, type CoverSelection } from "@/components/cover-cropper";

function list(value: FormDataEntryValue | null, separator: string) {
  return String(value || "").split(separator).map(v => v.trim()).filter(Boolean);
}

function audioLength(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let finished = false;
    const finish = (length: number | null) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      resolve(length);
    };
    const timer = window.setTimeout(() => finish(null), 5000);
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? Math.max(1, Math.round(audio.duration)) : null);
    audio.onerror = () => finish(null);
    audio.preload = "metadata";
    audio.src = url;
  });
}

function TrackForm({ kind, track, onSaved, onCancel }: {
  kind: "beats" | "loops"; track: AdminTrack | null; onSaved: (saved: AdminTrack, created: boolean) => void; onCancel: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [coverCrop, setCoverCrop] = useState<CoverSelection | null>(null);
  const [hasWav, setHasWav] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [wavFile, setWavFile] = useState<File | null>(null);
  const previewId = useId();
  const [coverLoading, setCoverLoading] = useState(false);
  const autoBpm = useRef<string | null>(null);
  const autoTitle = useRef<string | null>(null);

  function readFilename(file?: File, preview = false) {
    if (!file || !audioTypes[file.name.split(".").pop()?.toLowerCase() || ""]) return;
    const metadata = metadataFromFilename(file.name);
    const title = form.current?.elements.namedItem("title");
    const notes = form.current?.elements.namedItem("notes");
    if (title instanceof HTMLInputElement && (!title.value || title.value === autoTitle.current)) {
      title.value = metadata.title.slice(0, 120);
      autoTitle.current = title.value;
    }
    if (notes instanceof HTMLTextAreaElement) notes.value = [...new Set([...notes.value.split("\n").filter(Boolean), ...metadata.notes])].join("\n");
    const input = form.current?.elements.namedItem("bpm");
    if (!(input instanceof HTMLInputElement) || (input.value && input.value !== autoBpm.current)) return;
    const bpm = metadata.bpm;
    if (bpm !== null) {
      input.value = String(bpm);
      autoBpm.current = input.value;
    } else if (preview && autoBpm.current !== null) {
      input.value = "";
      autoBpm.current = null;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (coverLoading) return;
    const values = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      const supabase = createBrowserSupabaseClient();
      const uploaded: { bucket: string; path: string }[] = [];
      const id = track?.id || crypto.randomUUID();
      async function upload(field: string, bucket: string, types: Record<string, string>, limit: number) {
        const file = values.get(field);
        if (!(file instanceof File) || !file.size) return null;
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        if (!types[ext]) throw new Error(`Unsupported ${field} format.`);
        if (file.size > limit * 1024 * 1024) throw new Error(`${field} must be ${limit} MB or smaller.`);
        setStatus(`Uploading ${field}…`);
        const path = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: types[ext], upsert: false });
        if (uploadError) throw new Error(`Couldn't upload ${field}: ${uploadError.message}`);
        uploaded.push({ bucket, path });
        return { path, file };
      }
      try {
        values.delete("cover");
        if (kind === "beats" && coverCrop) {
          setStatus("Preparing cover crop…");
          values.set("cover", await croppedCover(coverCrop));
        }
        let generatedDuration: number | null = null;
        const sourceWav = values.get("wav");
        if (kind === "beats" && sourceWav instanceof File && sourceWav.size) {
          const { wavToMp3 } = await import("@/lib/wav-to-mp3");
          const generated = await wavToMp3(sourceWav, setStatus);
          values.set("mp3", generated.mp3);
          const previewFile = values.get("preview");
          if (!(previewFile instanceof File) || !previewFile.size) values.set("preview", generated.preview);
          generatedDuration = generated.duration;
        }
        const preview = await upload("preview", "track-previews", audioTypes, 50);
        const cover = kind === "beats" ? await upload("cover", "track-covers", coverTypes, 5) : null;
        const mp3 = kind === "beats" ? await upload("mp3", "purchased-beats", {mp3: "audio/mpeg"}, 50) : null;
        const wav = kind === "beats" ? await upload("wav", "purchased-beats", {wav: "audio/wav"}, 50) : null;
        const download = kind === "loops" ? await upload("download", "purchased-beats", { ...audioTypes, zip: "application/zip" }, 50) : null;
        const previewPath = preview?.path || track?.preview_path;
        if (!previewPath) throw new Error("Choose a preview audio file.");
        const duration = String(values.get("duration") || "").trim();
        setStatus("Saving track…");
        const parsed = parseTrackText(String(values.get("title") || ""));
        const payload: AdminTrack = {
          id, kind, title: parsed.title, bpm: Number(values.get("bpm")),
          duration_seconds: duration ? Number(duration) : generatedDuration ?? (preview ? await audioLength(preview.file) : track?.duration_seconds ?? null),
          genre: track?.genre || "", musical_key: track?.musical_key || "",
          description: track?.description || "",
          moods: track?.moods || [], tags: list(values.get("tags"), ","), notes: [...new Set([...list(values.get("notes"), "\n"), ...parsed.notes])],
          preview_path: previewPath, cover_path: kind === "beats" ? cover?.path || track?.cover_path || null : null,
          published: track?.published ?? false,
        };
        const leases = ([{lease:"mp3" as const, upload:mp3}, {lease:"wav" as const, upload:wav}]).flatMap(({lease,upload})=>upload ? [{lease,path:upload.path,name:upload.file.name.replace(/[^\w. ()-]/g,"_").slice(0,200)}] : []);
        const result = await saveTrack(payload, download?.path, download?.file.name.replace(/[^\w. ()-]/g, "_").slice(0, 200), leases);
        if (result.error) throw new Error(result.error);
        form.current?.reset();
        setHasWav(false);
        setPreviewFile(null); setWavFile(null);
        autoBpm.current = null;
        autoTitle.current = null;
        setCoverCrop(null);
        setStatus(payload.published ? "Published. Your track is now in the catalog." : "Draft saved.");
        onSaved(payload, !track);
      } catch (problem) {
        setStatus("");
        setError(problem instanceof Error ? problem.message : "Couldn't save your track. Please try again.");
        // RLS only permits removing unreferenced files, even if the save response was lost.
        for (const file of uploaded) await supabase.storage.from(file.bucket).remove([file.path]);
      }
    });
  }

  return (
    <section className="admin-editor">
      <div className="admin-section-heading"><h2>{track ? "Edit" : "Upload"} {kind === "beats" ? "beat" : "loop"}</h2>
        {track && <button className="auth-text-link" type="button" disabled={pending} onClick={onCancel}>Cancel edit</button>}
      </div>
      {(track || previewFile || wavFile) && <AdminPreview id={track?.id || `admin-upload-${previewId}`} title={track?.title || wavFile?.name || previewFile?.name || "Untitled"} bpm={track?.bpm || 0} file={wavFile || previewFile} previewPath={track?.preview_path} coverPath={track?.cover_path} />}
      <form ref={form} onSubmit={submit} onKeyDown={event => { if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type !== "file") event.preventDefault(); }}>
        <fieldset disabled={pending} className="admin-fields">
          <label>Title<input name="title" required maxLength={120} defaultValue={track?.title} onBlur={event => { const parsed = parseTrackText(event.target.value); event.target.value = parsed.title; const notes = form.current?.elements.namedItem("notes"); if (notes instanceof HTMLTextAreaElement) notes.value = [...new Set([...notes.value.split("\n").filter(Boolean), ...parsed.notes])].join("\n"); }} /></label>
          <div className="admin-field-pair">
            <label>BPM<span className="admin-hint">Auto from filename, e.g. 140bpm · editable</span><input name="bpm" type="number" required min={1} max={400} step={1} defaultValue={track?.bpm} onChange={() => { autoBpm.current = null; }} /></label>
            <label>Length in seconds<input name="duration" type="number" min={1} max={86400} step={1} placeholder="Auto from preview" defaultValue={track?.duration_seconds ?? ""} /></label>
          </div>
          <label>Tags<span className="admin-hint">Separate with commas</span><input name="tags" maxLength={2400} defaultValue={track?.tags.join(", ")} /></label>
          <label>Additional notes<span className="admin-hint">One per line</span><textarea name="notes" maxLength={15000} rows={2} defaultValue={track?.notes.join("\n")} /></label>
          <label>Preview audio<span className="admin-hint">Public · up to 50 MB{kind === "beats" ? " · optional with WAV: creates a 30-second preview" : track ? " · leave empty to keep current" : ""}</span>
            <input name="preview" type="file" accept=".mp3,.wav,.ogg,.m4a,.flac" required={!track && (kind !== "beats" || !hasWav)} onChange={event => { setPreviewFile(event.target.files?.[0] || null); readFilename(event.target.files?.[0], true); }} /></label>
          {kind === "beats" && <CoverCropper value={coverCrop} onChange={setCoverCrop} onLoading={setCoverLoading} existingCover={Boolean(track?.cover_path)} />}
          {kind === "beats" ? <>
            <label>WAV lease download<span className="admin-hint">Private · up to 50 MB · creates a 320 kbps MP3 automatically · leave empty to keep current</span><input name="wav" type="file" accept=".wav" onChange={event=>{ setHasWav(Boolean(event.target.files?.[0])); setWavFile(event.target.files?.[0] || null); readFilename(event.target.files?.[0]); }} /></label>
          </> : <label>Purchased download<span className="admin-hint">Private · audio or ZIP · optional · up to 50 MB · existing file stays unless replaced</span>
            <input name="download" type="file" accept=".mp3,.wav,.ogg,.m4a,.flac,.zip" onChange={event => readFilename(event.target.files?.[0])} /></label>}
          {!track && <p className="admin-hint">Uploads save as drafts. Use Publish in your catalog when ready.</p>}
          {kind === "beats" && <p className="admin-hint">MP3 $24.99 CAD · WAV $34.99 CAD. Upload a WAV to enable both leases.</p>}
          <button className="auth-submit" type="submit" disabled={coverLoading}>{coverLoading ? "Opening cover…" : pending ? status || "Please wait…" : track ? "Save changes" : "Upload draft"}</button>
        </fieldset>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {!pending && status && <p className="auth-message" role="status">{status}</p>}
      </form>
    </section>
  );
}

export function AdminDashboard({ tracks, loadError }: { tracks: AdminTrack[]; loadError: boolean }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [kind, setKind] = useState<"beats" | "loops">("beats");
  const [editing, setEditing] = useState<AdminTrack | null>(null);
  const [bulk, setBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotification, setBulkNotification] = useState<{ count: number; kind: "beats" | "loops"; published: boolean } | null>(null);
  const [notification, setNotification] = useState<{ track: AdminTrack; created: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function toggle(track: AdminTrack) {
    setError("");
    startTransition(async () => {
      const result = await setTrackPublished(track.id, !track.published);
      if (result.error) setError(result.error);
    });
  }
  function remove(track: AdminTrack) {
    if (pending || bulkBusy || !window.confirm(`Delete “${track.title}”? It will be removed from your catalog. Existing customers will keep their downloads.`)) return;
    setError(""); setDeleting(track.id);
    startTransition(async () => {
      try {
        const result = await deleteTrack(track.id);
        if (result.error) setError(result.error);
        else if (editing?.id === track.id) setEditing(null);
      } catch { setError("Couldn't delete this track. Please try again."); }
      finally { setDeleting(null); }
    });
  }
  return <section className="admin-dashboard">
    <h1>Dashboard</h1>
    <div className="admin-tabs" role="group" aria-label="Catalog section">
      <button type="button" disabled={bulkBusy} aria-pressed={kind === "beats"} onClick={() => { setKind("beats"); setEditing(null); }}>Beats</button>
      <button type="button" disabled={bulkBusy} aria-pressed={kind === "loops"} onClick={() => { setKind("loops"); setEditing(null); }}>Loops</button>
    </div>
    {loadError ? <p className="auth-error" role="alert">Couldn’t load your tracks. Please refresh before uploading.</p> : <>
      <div className="admin-upload-modes" role="group" aria-label="Upload mode"><button type="button" disabled={bulkBusy} aria-pressed={!bulk} onClick={() => setBulk(false)}>Single upload</button><button type="button" disabled={bulkBusy} aria-pressed={bulk} onClick={() => { setBulk(true); setEditing(null); }}>Folder / bulk upload</button></div>
      {bulk && <BulkUpload key={kind} kind={kind} onBusy={setBulkBusy} onCompleted={(count, published) => { setNotification(null); setBulkNotification({ count, kind, published }); }} />}
      <div className={`admin-layout${bulk ? " admin-layout-bulk" : ""}`}>
        {!bulk && <TrackForm key={`${kind}-${editing?.id || "new"}`} kind={kind} track={editing} onSaved={(track, created) => { setEditing(null); setBulkNotification(null); setNotification({ track, created }); }} onCancel={() => setEditing(null)} />}
        <section className="admin-catalog"><h2>Your {kind}</h2>
          {tracks.filter(t => t.kind === kind).length === 0 && <p className="auth-message">No {kind} uploaded yet.</p>}
          <ul>{tracks.filter(t => t.kind === kind).map(track => <li key={track.id}>
            <div><h3>{track.title}</h3><p>{track.bpm} BPM · {track.published ? "Published" : "Draft"}</p></div>
            <div className="admin-row-actions"><button type="button" disabled={bulkBusy} onClick={() => { setBulk(false); setEditing(track); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
              <AdminPreview id={track.id} title={track.title} bpm={track.bpm} previewPath={track.preview_path} coverPath={track.cover_path} />
              <button type="button" disabled={pending || bulkBusy} onClick={() => toggle(track)}>{track.published ? "Hide" : "Publish"}</button>
              <button type="button" className="admin-delete" disabled={pending || bulkBusy} onClick={() => remove(track)} aria-label={`Delete ${track.title}`}>{deleting === track.id ? "Deleting…" : "Delete"}</button></div>
          </li>)}</ul>
          {error && <p className="auth-error" role="alert">{error}</p>}
        </section>
      </div>
    </>}
    {notification && <SuccessNotification key={notification.track.id} message={<>{notification.created ? "Uploaded" : "Saved"} <strong>{notification.track.title}</strong>{!notification.track.published && " as a draft"}</>} action={<Link href={`/?view=${notification.track.kind}`} prefetch={false} className="cart-notification-view">View {notification.track.kind} ↗</Link>} onDismiss={() => setNotification(null)} />}
    {bulkNotification && <SuccessNotification message={<>Uploaded <strong>{bulkNotification.count} {bulkNotification.kind}</strong>{!bulkNotification.published && " as drafts"}</>} action={<Link href={`/?view=${bulkNotification.kind}`} prefetch={false} className="cart-notification-view">View {bulkNotification.kind} ↗</Link>} onDismiss={() => setBulkNotification(null)} />}
  </section>;
}
