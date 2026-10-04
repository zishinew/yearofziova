"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { planBulkUpload } from "@/lib/bulk-upload-plan";
import { bulkTrackError, uploadBulkTrack, type BulkTrack } from "@/lib/bulk-track-upload";

type Entry = BulkTrack & { status: "queued" | "uploading" | "done" | "error"; message: string };
export function BulkUpload({ kind, onBusy, onCompleted }: { kind: "beats" | "loops"; onBusy: (busy: boolean) => void; onCompleted: (count: number, published: boolean) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const running = useRef(false);
  const stop = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  function choose(files: FileList | null) {
    if (!files || running.current) return;
    const planned = planBulkUpload(Array.from(files), kind);
    setEntries(planned.map(entry => ({ ...entry, id: crypto.randomUUID(), bpm: entry.bpm === null ? "" : String(entry.bpm), status: "queued", message: "" })));
    setSummary(planned.length ? `${planned.length} ${kind} found. Matching covers and ZIP previews are included; other files are skipped.` : `No ${kind === "beats" ? "WAV files" : "audio or ZIP files"} found.`);
  }
  function update(id: string, patch: Partial<Entry>) {
    setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, ...patch } : entry));
  }
  const remaining = entries.filter(entry => entry.status !== "done");
  const invalid = remaining.some(entry => bulkTrackError(entry, kind));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || !remaining.length || invalid) return;
    const values = new FormData(event.currentTarget);
    const published = values.get("published") === "on";
    const tags = String(values.get("tags") || "").split(",").map(tag => tag.trim()).filter(Boolean);
    const notes = String(values.get("notes") || "").split("\n").map(note => note.trim()).filter(Boolean);
    if (tags.length > 30 || tags.some(tag => tag.length > 80) || notes.length > 30 || notes.some(note => note.length > 500)) {
      setSummary("Use up to 30 tags (80 characters each) and 30 notes (500 characters each).");
      return;
    }
    running.current = true; stop.current = false; setBusy(true); onBusy(true); setSummary("");
    let succeeded = 0;
    let failed = 0;
    try {
      for (const entry of remaining) {
        if (stop.current) break;
        update(entry.id, { status: "uploading", message: "Preparing…" });
        try {
          await uploadBulkTrack(entry, kind, published, tags, notes, message => update(entry.id, { message }));
          update(entry.id, { status: "done", message: published ? "Uploaded · Published" : "Uploaded · Draft" });
          succeeded++;
        } catch (error) {
          update(entry.id, { status: "error", message: error instanceof Error ? error.message : "Upload failed. Try again." });
          failed++;
        }
      }
    } finally {
      running.current = false; setBusy(false); onBusy(false);
      setSummary(`${succeeded} uploaded${failed ? ` · ${failed} failed — fix or retry them below` : ""}${stop.current ? " · Stopped. Remaining files are still queued." : ""}.`);
      if (succeeded) onCompleted(succeeded, published);
    }
  }
  return <section className="admin-bulk">
    <h2>Bulk upload {kind}</h2>
    <p className="admin-hint">{kind === "beats" ? "Choose a folder of WAVs. Each becomes a beat with an automatic MP3 and 30-second preview." : "Each audio file becomes a loop. ZIP kits use matching preview audio, e.g. kit.zip + kit-preview.mp3."} Titles and BPM are inferred from filenames. Covers match the filename or cover.jpg in the same folder.</p>
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="admin-fields">
        <div className="admin-field-pair">
          <label>Choose a folder<input type="file" multiple {...{ webkitdirectory: "" }} onChange={event => { choose(event.target.files); event.target.value = ""; }} /></label>
          <label>Or select multiple files<input type="file" multiple accept={kind === "beats" ? ".wav,.jpg,.jpeg,.png,.webp" : ".mp3,.wav,.ogg,.m4a,.flac,.zip,.jpg,.jpeg,.png,.webp"} onChange={event => { choose(event.target.files); event.target.value = ""; }} /></label>
        </div>
        {entries.length > 0 && <>
          <label>Tags for all uploads<input name="tags" maxLength={2400} placeholder="Separate with commas" /></label>
          <label>Additional notes for all uploads<textarea name="notes" maxLength={15000} rows={2} /></label>
          <label className="admin-checkbox"><input name="published" type="checkbox" defaultChecked />Publish in {kind === "beats" ? "Beat Vault" : "Loop Kit"}</label>
        </>}
      </fieldset>
      {entries.length > 0 && <ul className="bulk-queue" aria-label="Upload queue">
        {entries.map(entry => <li key={entry.id} className={`bulk-entry bulk-entry-${entry.status}`}>
          <div className="bulk-file-name">{entry.file.webkitRelativePath || entry.file.name}</div>
          <fieldset disabled={busy || entry.status === "done"} className="admin-fields">
            <div className="bulk-entry-fields"><label>Title<input value={entry.title} maxLength={120} onChange={event => update(entry.id, { title: event.target.value, status: "queued", message: "" })} /></label><label>BPM<input type="number" min={1} max={400} step={1} value={entry.bpm} onChange={event => update(entry.id, { bpm: event.target.value, status: "queued", message: "" })} /></label></div>
            <div className="admin-field-pair"><label>Cover art<span className="admin-hint">{entry.cover?.name || "Optional"}</span><input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={event => update(entry.id, { cover: event.target.files?.[0] || null, status: "queued", message: "" })} /></label>
              {kind === "loops" && /\.zip$/i.test(entry.file.name) && <label>Preview audio<span className="admin-hint">{entry.preview?.name || "Required for ZIP kits"}</span><input type="file" accept=".mp3,.wav,.ogg,.m4a,.flac" onChange={event => update(entry.id, { preview: event.target.files?.[0] || null, status: "queued", message: "" })} /></label>}
            </div>
          </fieldset>
          <div className="bulk-entry-footer"><p className={entry.status === "error" || (entry.status === "queued" && bulkTrackError(entry, kind)) ? "auth-error" : "auth-message"} role="status">{entry.message || bulkTrackError(entry, kind) || "Ready to upload"}</p>{!busy && entry.status !== "done" && <button type="button" className="auth-text-link" onClick={() => setEntries(previous => previous.filter(item => item.id !== entry.id))}>Remove</button>}</div>
        </li>)}
      </ul>}
      <div className="bulk-upload-actions">
        {remaining.length > 0 && <button className="auth-submit" type="submit" disabled={busy || invalid}>{busy ? "Uploading…" : `Upload ${remaining.length} ${kind}`}</button>}
        {busy && <button className="auth-text-link" type="button" onClick={() => { stop.current = true; setSummary("Stopping after the current file finishes…"); }}>Stop after current file</button>}
        {!busy && entries.length > 0 && <button className="auth-text-link" type="button" onClick={() => { setEntries([]); setSummary(""); }}>Clear queue</button>}
      </div>
      {summary && <p className="auth-message bulk-summary" role="status">{summary}</p>}
      {busy && <p className="admin-hint">Keep this page open until the uploads finish.</p>}
    </form>
  </section>;
}
