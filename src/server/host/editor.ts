import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { AccessError, actorOf, requireHostPage } from "./access";
import { getListingForEditor } from "./listings";

/**
 * Editor data for one listing, shared by the editor layout and its section pages in one request.
 * Sends people who cannot manage the listing to a 404 instead of revealing that it exists.
 */
export const loadEditor = cache(async (listingId: string) => {
  const viewer = await requireHostPage(`/host/listings/${listingId}`);
  const actor = actorOf(viewer);
  try {
    return { viewer, actor, ...(await getListingForEditor(actor, listingId)) };
  } catch (err) {
    if (err instanceof AccessError && err.code === "not_found") notFound();
    throw err;
  }
});
