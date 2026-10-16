import { z } from "zod";
import { AccessError, requireActor } from "@/server/host/access";
import { ValidationError } from "@/server/host/errors";
import { loadManagedListing } from "@/server/host/listings";
import { addPhoto } from "@/server/host/photos";
import { storeImage, UploadError } from "@/server/host/uploads";

const fieldsSchema = z.object({
  listingId: z
    .string()
    .regex(/^lst_[a-z0-9]+$/)
    .optional(),
  alt: z.string().trim().max(200).optional(),
});

/**
 * POST /api/uploads (multipart/form-data)
 * Fields: `file` (JPEG, PNG, WebP or AVIF, up to 10 MB), optional `listingId` to attach the
 * photo to a listing the caller manages, optional `alt`.
 * Returns { url, width, height } and, with a listingId, the new photo row.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireActor(["host", "admin"]);
    const form = await request.formData().catch(() => null);
    if (!form) return json(400, { error: "Send the photo as multipart form data." });
    const file = form.get("file");
    if (!(file instanceof File)) return json(400, { error: "Choose a photo to upload." });
    const fields = fieldsSchema.safeParse({ listingId: form.get("listingId") ?? undefined, alt: form.get("alt") ?? undefined });
    if (!fields.success) return json(400, { error: "That listing reference is not valid." });

    const folder = fields.data.listingId ?? `user-${actor.userId}`;
    if (fields.data.listingId) {
      // Fail before storing anything when the listing is not the caller's.
      await loadManagedListing(actor, fields.data.listingId);
    }
    const stored = await storeImage(file, { folder });
    if (!fields.data.listingId) return json(201, { url: stored.url, width: stored.width, height: stored.height });

    const photo = await addPhoto(actor, fields.data.listingId, { url: stored.url, width: stored.width, height: stored.height, alt: fields.data.alt });
    return json(201, { url: stored.url, width: stored.width, height: stored.height, photo: { id: photo.id, alt: photo.alt, position: photo.position } });
  } catch (err) {
    if (err instanceof UploadError) return json(err.status, { error: err.message });
    if (err instanceof AccessError) return json(err.code === "unauthenticated" ? 401 : err.code === "forbidden" ? 403 : 404, { error: err.message });
    if (err instanceof ValidationError) return json(400, { error: err.message });
    console.error("upload failed", err);
    return json(500, { error: "The upload failed on our side. Try again in a minute." });
  }
}

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
