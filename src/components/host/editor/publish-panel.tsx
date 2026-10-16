"use client";

import { publish, unpublish } from "@/app/host/actions";
import { ActionForm, SubmitButton } from "../form";

export function PublishButton({ listingId, disabled, republish }: { listingId: string; disabled: boolean; republish?: boolean }) {
  return (
    <ActionForm action={publish.bind(null, listingId)} aria-label="Publish listing">
      <SubmitButton disabled={disabled} pendingLabel="Publishing">
        {republish ? "Publish again" : "Publish listing"}
      </SubmitButton>
    </ActionForm>
  );
}

export function UnpublishButton({ listingId }: { listingId: string }) {
  return (
    <ActionForm action={unpublish.bind(null, listingId)} aria-label="Unpublish listing">
      <p className="mb-3 text-sm text-slate">Unpublishing hides the listing from search and its page. Existing bookings stay as they are.</p>
      <SubmitButton variant="secondary" pendingLabel="Unpublishing">
        Unpublish listing
      </SubmitButton>
    </ActionForm>
  );
}
