"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type CoverSelection = {
  file: File; width: number; height: number; x: number; y: number; zoom: number;
};

function constrain(crop: CoverSelection): CoverSelection {
  const half = Math.min(crop.width, crop.height) / crop.zoom / 2;
  return { ...crop, x: Math.max(half, Math.min(crop.width - half, crop.x)), y: Math.max(half, Math.min(crop.height - half, crop.y)) };
}

export async function croppedCover(crop: CoverSelection): Promise<File> {
  const url = URL.createObjectURL(crop.file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const side = Math.min(crop.width, crop.height) / crop.zoom;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.max(1, Math.min(1024, Math.floor(side)));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn't prepare the cover image.");
    context.drawImage(image, crop.x - side / 2, crop.y - side / 2, side, side, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Couldn't crop this image.")), "image/png"));
    return new File([blob], "cover.png", { type: "image/png" });
  } finally { URL.revokeObjectURL(url); }
}

export function CoverCropper({ value, onChange, onLoading, existingCover }: {
  value: CoverSelection | null; onChange: (crop: CoverSelection | null) => void;
  onLoading: (loading: boolean) => void; existingCover: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const imageUrl = useRef("");
  const request = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; crop: CoverSelection } | null>(null);
  useEffect(() => () => { request.current++; URL.revokeObjectURL(imageUrl.current); }, []);

  async function choose(file?: File) {
    const ticket = ++request.current;
    setError("");
    onChange(null);
    setUrl("");
    URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = "";
    if (!file) { onLoading(false); return; }
    if (file.size > 5 * 1024 * 1024 || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setError("Choose a JPG, PNG or WEBP image up to 5 MB.");
      onLoading(false);
      return;
    }
    onLoading(true);
    const candidate = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = candidate;
      await image.decode();
      if (ticket !== request.current) { URL.revokeObjectURL(candidate); return; }
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("Invalid image");
      imageUrl.current = candidate;
      setUrl(candidate);
      onChange({ file, width: image.naturalWidth, height: image.naturalHeight, x: image.naturalWidth / 2, y: image.naturalHeight / 2, zoom: 1 });
    } catch {
      URL.revokeObjectURL(candidate);
      if (ticket === request.current) setError("Couldn't open this image. Try another file.");
    } finally { if (ticket === request.current) onLoading(false); }
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !value) return;
    const start = drag.current;
    const side = Math.min(start.crop.width, start.crop.height) / start.crop.zoom;
    const ratio = side / event.currentTarget.getBoundingClientRect().width;
    onChange(constrain({ ...start.crop, x: start.crop.x - (event.clientX - start.x) * ratio, y: start.crop.y - (event.clientY - start.y) * ratio }));
  }

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!value || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = Math.min(value.width, value.height) / value.zoom * (event.shiftKey ? 0.1 : 0.02);
    onChange(constrain({ ...value,
      x: value.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
      y: value.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0),
    }));
  }
  const side = value ? Math.min(value.width, value.height) / value.zoom : 1;

  return <div className="cover-editor">
    <label>Cover art<span className="admin-hint">JPG, PNG or WEBP · up to 5 MB{existingCover ? " · leave empty to keep current" : ""}</span>
      <input ref={input} name="cover" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={event => void choose(event.target.files?.[0])} /></label>
    {value && url && <div className="cover-crop-controls">
      <div className="cover-crop-window" role="group" aria-label="Cover crop preview" aria-describedby="cover-crop-help" tabIndex={0}
        onKeyDown={keyboard}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, crop: value };
        }}
        onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
        {/* Local blob preview; the exported canvas uses the same square coordinates. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Selected cover" draggable={false} style={{ width: `${value.width / side * 100}%`, height: `${value.height / side * 100}%`, left: `${(0.5 - value.x / side) * 100}%`, top: `${(0.5 - value.y / side) * 100}%` }} />
        <span className="cover-crop-grid" aria-hidden="true" />
      </div>
      <p id="cover-crop-help" className="admin-hint">Drag to reposition, or use the arrow keys. The square shown is what gets uploaded.</p>
      <label>Zoom<input type="range" min={1} max={4} step={0.01} value={value.zoom} onChange={event => onChange(constrain({ ...value, zoom: Number(event.target.value) }))} /></label>
      <div className="cover-crop-actions">
        <button type="button" onClick={() => onChange({ ...value, zoom: 1, x: value.width / 2, y: value.height / 2 })}>Reset crop</button>
        <button type="button" onClick={() => { if (input.current) input.current.value = ""; void choose(); }}>Remove selected cover</button>
      </div>
    </div>}
    {error && <p className="auth-error" role="alert">{error}</p>}
  </div>;
}
