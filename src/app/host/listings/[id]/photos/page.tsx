import type { Metadata } from "next";
import { PhotoManager } from "@/components/host/editor/photo-manager";
import { loadEditor } from "@/server/host/editor";
import { MAX_PHOTOS } from "@/server/host/photos";
import { MIN_PHOTOS } from "@/server/host/rules";

export const instant = false;
export const metadata: Metadata = { title: "Photos" };

export default async function PhotosPage({ params }: PageProps<"/host/listings/[id]/photos">) {
  const { id } = await params;
  const { photos } = await loadEditor(id);
  return (
    <PhotoManager
      listingId={id}
      minPhotos={MIN_PHOTOS}
      maxPhotos={MAX_PHOTOS}
      photos={photos.map((p) => ({ id: p.id, url: p.url, alt: p.alt, width: p.width, height: p.height }))}
    />
  );
}
