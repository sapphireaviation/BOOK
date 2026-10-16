"use client";

import { setPublished } from "@/app/host/actions";
import { ActionForm, SubmitButton } from "../form";

/**
 * One form for both directions, so the result message survives the switch
 * from draft to live and back.
 */
export function PublishControls({ listingId, published, ready, republish }: { listingId: string; published: boolean; ready: boolean; republish: boolean }) {
  return (
    <ActionForm action={setPublished.bind(null, listingId)} aria-label={published ? "Unpublish listing" : "Publish listing"}>
      {published ? (
        <>
          <p className="mb-3 text-sm text-slate">Unpublishing hides the listing from search and its page. Existing bookings stay as they are.</p>
          <SubmitButton variant="secondary" name="intent" value="unpublish" pendingLabel="Unpublishing">
            Unpublish listing
          </SubmitButton>
        </>
      ) : (
        <SubmitButton name="intent" value="publish" disabled={!ready} pendingLabel="Publishing">
          {republish ? "Publish again" : "Publish listing"}
        </SubmitButton>
      )}
    </ActionForm>
  );
}
