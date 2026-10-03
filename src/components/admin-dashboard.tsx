"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { saveTrack, setTrackPublished } from "@/app/admin/actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { audioTypes, coverTypes, bpmFromFilename, type AdminTrack } from "@/lib/track-upload";
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
  kind: "beats" | "loops"; track: AdminTrack | null; onSaved: () => void; onCancel: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [coverCrop, setCoverCrop] = useState<CoverSelection | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const autoBpm = useRef<string | null>(null);

  function readFilename(file?: File, preview = false) {
    if (!file || !audioTypes[file.name.split(".").pop()?.toLowerCase() || ""]) return;
    const input = form.current?.elements.namedItem("bpm");
    if (!(input instanceof HTMLInputElement) || (input.value && input.value !== autoBpm.current)) return;
    const bpm = bpmFromFilename(file.name);
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
        if (coverCrop) {
          setStatus("Preparing cover crop…");
          values.set("cover", await croppedCover(coverCrop));
        }
        const preview = await upload("preview", "track-previews", audioTypes, 50);
        const cover = await upload("cover", "track-covers", coverTypes, 5);
        const mp3 = kind === "beats" ? await upload("mp3", "purchased-beats", {mp3: "audio/mpeg"}, 50) : null;
        const wav = kind === "beats" ? await upload("wav", "purchased-beats", {wav: "audio/wav"}, 50) : null;
        const download = kind === "loops" ? await upload("download", "purchased-beats", { ...audioTypes, zip: "application/zip" }, 50) : null;
        const previewPath = preview?.path || track?.preview_path;
        if (!previewPath) throw new Error("Choose a preview audio file.");
        const duration = String(values.get("duration") || "").trim();
        setStatus("Saving track…");
        const payload: AdminTrack = {
          id, kind, title: String(values.get("title") || "").trim(), bpm: Number(values.get("bpm")),
          duration_seconds: duration ? Number(duration) : preview ? await audioLength(preview.file) : track?.duration_seconds ?? null,
          genre: track?.genre || "", musical_key: track?.musical_key || "",
          description: track?.description || "",
          moods: track?.moods || [], tags: list(values.get("tags"), ","), notes: list(values.get("notes"), "\n"),
          preview_path: previewPath, cover_path: cover?.path || track?.cover_path || null,
          published: values.get("published") === "on",
        };
        const leases = ([{lease:"mp3" as const, upload:mp3}, {lease:"wav" as const, upload:wav}]).flatMap(({lease,upload})=>upload ? [{lease,path:upload.path,name:upload.file.name.replace(/[^\w. ()-]/g,"_").slice(0,200)}] : []);
        const result = await saveTrack(payload, download?.path, download?.file.name.replace(/[^\w. ()-]/g, "_").slice(0, 200), leases);
        if (result.error) throw new Error(result.error);
        form.current?.reset();
        autoBpm.current = null;
        setCoverCrop(null);
        setStatus(payload.published ? "Published. Your track is now in the catalog." : "Draft saved.");
        onSaved();
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
      <form ref={form} onSubmit={submit}>
        <fieldset disabled={pending} className="admin-fields">
          <label>Title<input name="title" required maxLength={120} defaultValue={track?.title} /></label>
          <div className="admin-field-pair">
            <label>BPM<span className="admin-hint">Auto from filename, e.g. 140bpm · editable</span><input name="bpm" type="number" required min={1} max={400} step={1} defaultValue={track?.bpm} onChange={() => { autoBpm.current = null; }} /></label>
            <label>Length in seconds<input name="duration" type="number" min={1} max={86400} step={1} placeholder="Auto from preview" defaultValue={track?.duration_seconds ?? ""} /></label>
          </div>
          <label>Tags<span className="admin-hint">Separate with commas</span><input name="tags" maxLength={2400} defaultValue={track?.tags.join(", ")} /></label>
          <label>Additional notes<span className="admin-hint">One per line</span><textarea name="notes" maxLength={15000} rows={2} defaultValue={track?.notes.join("\n")} /></label>
          <label>Preview audio<span className="admin-hint">Public · MP3, WAV, OGG, M4A or FLAC · up to 50 MB{track ? " · leave empty to keep current" : ""}</span>
            <input name="preview" type="file" accept=".mp3,.wav,.ogg,.m4a,.flac" required={!track} onChange={event => readFilename(event.target.files?.[0], true)} /></label>
          <CoverCropper value={coverCrop} onChange={setCoverCrop} onLoading={setCoverLoading} existingCover={Boolean(track?.cover_path)} />
          {kind === "beats" ? <>
            <label>MP3 lease download<span className="admin-hint">Private · MP3 · up to 50 MB · leave empty to keep current</span><input name="mp3" type="file" accept=".mp3" onChange={event=>readFilename(event.target.files?.[0])} /></label>
            <label>WAV lease download<span className="admin-hint">Private · WAV · up to 50 MB · leave empty to keep current</span><input name="wav" type="file" accept=".wav" onChange={event=>readFilename(event.target.files?.[0])} /></label>
          </> : <label>Purchased download<span className="admin-hint">Private · audio or ZIP · optional · up to 50 MB · existing file stays unless replaced</span>
            <input name="download" type="file" accept=".mp3,.wav,.ogg,.m4a,.flac,.zip" onChange={event => readFilename(event.target.files?.[0])} /></label>}
          <label className="admin-checkbox"><input name="published" type="checkbox" defaultChecked={track?.published ?? true} />Publish in {kind === "beats" ? "Beat Vault" : "Loop Kit"}</label>
          {kind === "beats" && <p className="admin-hint">MP3 $24.99 CAD · WAV $34.99 CAD. Upload each format to enable its checkout.</p>}
          <button className="auth-submit" type="submit" disabled={coverLoading}>{coverLoading ? "Opening cover…" : pending ? status || "Please wait…" : track ? "Save changes" : "Upload track"}</button>
        </fieldset>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {!pending && status && <p className="auth-message" role="status">{status}</p>}
      </form>
    </section>
  );
}

export function AdminDashboard({ tracks, loadError }: { tracks: AdminTrack[]; loadError: boolean }) {
  const [kind, setKind] = useState<"beats" | "loops">("beats");
  const [editing, setEditing] = useState<AdminTrack | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function toggle(track: AdminTrack) {
    setError("");
    startTransition(async () => {
      const result = await setTrackPublished(track.id, !track.published);
      if (result.error) setError(result.error);
    });
  }
  return <section className="admin-dashboard">
    <h1>Dashboard</h1>
    <div className="admin-tabs" role="group" aria-label="Catalog section">
      <button type="button" aria-pressed={kind === "beats"} onClick={() => { setKind("beats"); setEditing(null); }}>Beats</button>
      <button type="button" aria-pressed={kind === "loops"} onClick={() => { setKind("loops"); setEditing(null); }}>Loops</button>
    </div>
    {loadError ? <p className="auth-error" role="alert">Couldn’t load your tracks. Please refresh before uploading.</p> : <>
      <div className="admin-layout">
        <TrackForm key={`${kind}-${editing?.id || "new"}`} kind={kind} track={editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
        <section className="admin-catalog"><h2>Your {kind}</h2>
          {tracks.filter(t => t.kind === kind).length === 0 && <p className="auth-message">No {kind} uploaded yet.</p>}
          <ul>{tracks.filter(t => t.kind === kind).map(track => <li key={track.id}>
            <div><h3>{track.title}</h3><p>{track.bpm} BPM · {track.published ? "Published" : "Draft"}</p></div>
            <div className="admin-row-actions"><button type="button" onClick={() => { setEditing(track); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
              <button type="button" disabled={pending} onClick={() => toggle(track)}>{track.published ? "Hide" : "Publish"}</button></div>
          </li>)}</ul>
          {error && <p className="auth-error" role="alert">{error}</p>}
        </section>
      </div>
    </>}
  </section>;
}
