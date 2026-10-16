"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { arrangePhoto, removePhoto, savePhotoAlt } from "@/app/host/actions";
import { Button, cn, Notice } from "@/components/ui";
import { ActionForm, SubmitButton, TextField, useFormState } from "../form";

export type PhotoItem = { id: string; url: string; alt: string; width: number | null; height: number | null };

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;

type UploadRow = { key: string; name: string; state: "waiting" | "uploading" | "done" | "failed"; error?: string };

export function PhotoManager({ listingId, photos, minPhotos, maxPhotos }: { listingId: string; photos: PhotoItem[]; minPhotos: number; maxPhotos: number }) {
  const router = useRouter();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const remaining = Math.max(0, minPhotos - photos.length);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, maxPhotos - photos.length));
    const queue: UploadRow[] = list.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, state: "waiting" }));
    const skipped = files.length - list.length;
    setRows(skipped > 0 ? [...queue, { key: "limit", name: `${skipped} more`, state: "failed", error: `A listing can have up to ${maxPhotos} photos.` }] : queue);
    setBusy(true);
    let uploaded = 0;
    for (const [i, file] of list.entries()) {
      const key = queue[i].key;
      const update = (patch: Partial<UploadRow>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
      if (!ACCEPT.includes(file.type)) {
        update({ state: "failed", error: "Not a JPEG, PNG, WebP or AVIF image." });
        continue;
      }
      if (file.size > MAX_BYTES) {
        update({ state: "failed", error: "Larger than 10 MB." });
        continue;
      }
      update({ state: "uploading" });
      try {
        const body = new FormData();
        body.set("file", file);
        body.set("listingId", listingId);
        const res = await fetch("/api/uploads", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) update({ state: "failed", error: json.error ?? "The upload failed. Try again." });
        else {
          update({ state: "done" });
          uploaded++;
        }
      } catch {
        update({ state: "failed", error: "The connection dropped. Try again." });
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (uploaded) startTransition(() => router.refresh());
  }

  const failed = rows.filter((r) => r.state === "failed").length;
  const done = rows.filter((r) => r.state === "done").length;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-dashed border-line-strong bg-surface p-5">
        <label htmlFor={inputId} className="block font-semibold">
          Add photos
        </label>
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-slate">
          JPEG, PNG, WebP or AVIF, up to 10 MB each. Landscape photos at least 1600 pixels wide look best. You can pick several at once.
        </p>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          disabled={busy}
          aria-describedby={`${inputId}-hint`}
          onChange={(e) => upload(e.target.files)}
          className="mt-3 block w-full text-sm file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:font-semibold file:text-ink hover:file:border-ink"
        />
        {rows.length > 0 && (
          <div aria-live="polite" className="mt-4">
            <ul className="divide-y divide-line rounded-md border border-line text-sm">
              {rows.map((r) => (
                <li key={r.key} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate">{r.name}</span>
                  <span className={cn("text-xs font-semibold", r.state === "failed" ? "text-signal" : r.state === "done" ? "text-fern" : "text-slate")}>
                    {r.state === "waiting" && "Waiting"}
                    {r.state === "uploading" && "Uploading"}
                    {r.state === "done" && "Uploaded"}
                    {r.state === "failed" && r.error}
                  </span>
                </li>
              ))}
            </ul>
            {!busy && (
              <p className="mt-2 text-sm font-semibold">
                {done > 0 && <span className="text-fern">{done === 1 ? "1 photo uploaded" : `${done} photos uploaded`}. </span>}
                {failed > 0 && <span className="text-signal">{failed === 1 ? "1 file was not uploaded." : `${failed} files were not uploaded.`}</span>}
              </p>
            )}
          </div>
        )}
      </div>

      {remaining > 0 && (
        <Notice tone="info">
          {photos.length === 0
            ? `Add at least ${minPhotos} photos to publish.`
            : `Add ${remaining} more ${remaining === 1 ? "photo" : "photos"} to publish. You have ${photos.length}.`}
        </Notice>
      )}

      {photos.length > 0 && (
        <div>
          <h2 className="text-lg">
            Your photos <span className="tnum font-semibold text-slate">({photos.length})</span>
          </h2>
          <p className="mt-1 text-sm text-slate">The first photo is the cover in search results. Describe each one for guests who use screen readers.</p>
          <ol className="mt-4 divide-y divide-line rounded-md border border-line bg-surface">
            {photos.map((p, i) => (
              <PhotoRow key={p.id} listingId={listingId} photo={p} index={i} count={photos.length} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function PhotoRow({ listingId, photo, index, count }: { listingId: string; photo: PhotoItem; index: number; count: number }) {
  return (
    <li className="grid gap-4 p-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="relative">
        <Image src={photo.url} alt={photo.alt} width={320} height={240} sizes="160px" className="aspect-[4/3] w-40 rounded-sm border border-line object-cover" />
        {index === 0 && <span className="absolute left-1.5 top-1.5 rounded-sm bg-ink px-1.5 py-0.5 text-xs font-semibold text-paper">Cover</span>}
      </div>
      <div className="min-w-0 space-y-3">
        <ActionForm action={savePhotoAlt.bind(null, listingId, photo.id)} aria-label={`Description for photo ${index + 1}`}>
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              name="alt"
              label={`Description of photo ${index + 1}`}
              defaultValue={photo.alt}
              maxLength={200}
              className="min-w-0 flex-1 basis-64"
              placeholder="For example: Bedroom with a double bed and a window onto the garden"
            />
            <SubmitButton variant="secondary" pendingLabel="Saving">
              Save description
            </SubmitButton>
          </div>
        </ActionForm>
        <div className="flex flex-wrap items-center gap-2">
          <MoveButton listingId={listingId} photoId={photo.id} direction="first" label="Make cover" disabled={index === 0} />
          <MoveButton listingId={listingId} photoId={photo.id} direction="up" label="Move up" disabled={index === 0} />
          <MoveButton listingId={listingId} photoId={photo.id} direction="down" label="Move down" disabled={index === count - 1} />
          <span className="tnum ml-auto text-xs text-slate">{photo.width && photo.height ? `${photo.width} by ${photo.height} px` : null}</span>
          <DeletePhoto listingId={listingId} photoId={photo.id} />
        </div>
      </div>
    </li>
  );
}

function MoveButton({ listingId, photoId, direction, label, disabled }: { listingId: string; photoId: string; direction: "up" | "down" | "first"; label: string; disabled: boolean }) {
  return (
    <ActionForm action={arrangePhoto.bind(null, listingId, photoId)} showStatus={false} aria-label={label} className="flex items-center gap-2">
      <input type="hidden" name="direction" value={direction} />
      <MoveSubmit label={label} disabled={disabled} />
    </ActionForm>
  );
}

function MoveSubmit({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending, state } = useFormState();
  return (
    <>
      <Button type="submit" variant="ghost" size="sm" pending={pending} disabled={disabled} className="border border-line">
        {label}
      </Button>
      <span aria-live="polite" className={cn("text-xs font-semibold", state.status === "error" ? "text-signal" : "text-fern")}>
        {state.status !== "idle" && !pending ? state.message : null}
      </span>
    </>
  );
}

function DeletePhoto({ listingId, photoId }: { listingId: string; photoId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" className="text-signal" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    );
  }
  return (
    <ActionForm action={removePhoto.bind(null, listingId, photoId)} aria-label="Delete photo" className="flex flex-wrap items-center gap-2">
      <SubmitButton variant="danger" size="sm" pendingLabel="Deleting">
        Delete photo
      </SubmitButton>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep it
      </Button>
    </ActionForm>
  );
}
