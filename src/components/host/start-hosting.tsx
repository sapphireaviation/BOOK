"use client";

import { startHosting } from "@/app/host/actions";
import { ActionForm, SubmitButton } from "./form";

export function StartHostingForm() {
  return (
    <ActionForm action={startHosting} aria-label="Start listing">
      <SubmitButton size="lg" pendingLabel="Starting">
        Start listing
      </SubmitButton>
    </ActionForm>
  );
}
