"use client";

import { useState } from "react";
import { changeRoleAction, markPaidAction, moderateListingAction, scheduleAction } from "@/app/admin/actions";
import { Button, cn, Input, Select } from "@/components/ui";
import { ActionForm, useFieldError, useFormState } from "@/components/host/form";

/** Inline result next to a row action. */
function RowStatus() {
  const { state, pending } = useFormState();
  if (pending || state.status === "idle") return null;
  return (
    <span aria-live="polite" className={cn("text-xs font-semibold", state.status === "ok" ? "text-fern" : "text-signal")}>
      {state.message}
    </span>
  );
}

function RowSubmit({ children, pendingLabel, variant = "secondary" }: { children: React.ReactNode; pendingLabel: string; variant?: "secondary" | "danger" | "primary" }) {
  const { pending } = useFormState();
  return (
    <Button type="submit" size="sm" variant={variant} pending={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function ModerateListing({ listingId, status, verified }: { listingId: string; status: string; verified: boolean }) {
  const action = moderateListingAction.bind(null, listingId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "suspended" ? (
        <ActionForm action={action} showStatus={false} aria-label="Restore listing" className="flex items-center gap-2">
          <input type="hidden" name="action" value="restore" />
          <RowSubmit pendingLabel="Restoring">Restore</RowSubmit>
          <RowStatus />
        </ActionForm>
      ) : (
        <ActionForm action={action} showStatus={false} aria-label="Suspend listing" className="flex items-center gap-2">
          <input type="hidden" name="action" value="suspend" />
          <RowSubmit variant="danger" pendingLabel="Suspending">
            Suspend
          </RowSubmit>
          <RowStatus />
        </ActionForm>
      )}
      <ActionForm action={action} showStatus={false} aria-label={verified ? "Remove verification" : "Verify listing"} className="flex items-center gap-2">
        <input type="hidden" name="action" value={verified ? "unverify" : "verify"} />
        <RowSubmit pendingLabel={verified ? "Removing" : "Verifying"}>{verified ? "Remove verification" : "Verify"}</RowSubmit>
        <RowStatus />
      </ActionForm>
    </div>
  );
}

export function RoleSelect({ userId, role, self, name }: { userId: string; role: string; self: boolean; name: string }) {
  return (
    <ActionForm action={changeRoleAction.bind(null, userId)} showStatus={false} aria-label={`Change role for ${name}`} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role for {name}
      </label>
      <Select id={`role-${userId}`} name="role" defaultValue={role} className="h-9 w-32 text-sm" disabled={self}>
        <option value="traveler">Traveler</option>
        <option value="host">Host</option>
        <option value="admin">Admin</option>
      </Select>
      {self ? <span className="text-xs text-slate">This is you</span> : <RowSubmit pendingLabel="Changing">Change role</RowSubmit>}
      <RowStatus />
    </ActionForm>
  );
}

export function PayoutActions({ payoutId, status }: { payoutId: string; status: string }) {
  const [open, setOpen] = useState(false);
  if (status !== "owed" && status !== "scheduled") return null;
  return (
    <div className="flex flex-wrap items-start gap-2">
      {!open && (
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Mark paid
        </Button>
      )}
      {open && (
        <ActionForm action={markPaidAction.bind(null, payoutId)} showStatus={false} aria-label="Mark payout paid" className="flex flex-wrap items-start gap-2">
          <TransferReference payoutId={payoutId} />
          <RowSubmit variant="primary" pendingLabel="Saving">
            Mark paid
          </RowSubmit>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
          <RowStatus />
        </ActionForm>
      )}
      {status === "owed" && !open && (
        <ActionForm action={scheduleAction.bind(null, payoutId)} showStatus={false} aria-label="Mark payout scheduled" className="flex items-center gap-2">
          <RowSubmit pendingLabel="Saving">Mark scheduled</RowSubmit>
          <RowStatus />
        </ActionForm>
      )}
    </div>
  );
}

function TransferReference({ payoutId }: { payoutId: string }) {
  const error = useFieldError("reference");
  return (
    <div>
      <label htmlFor={`ref-${payoutId}`} className="sr-only">
        Transfer reference
      </label>
      <Input
        id={`ref-${payoutId}`}
        name="reference"
        placeholder="Transfer reference"
        className="h-9 w-48 text-sm"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `ref-${payoutId}-error` : undefined}
        autoFocus
      />
      {error && (
        <p id={`ref-${payoutId}-error`} className="mt-1 text-xs font-semibold text-signal">
          {error}
        </p>
      )}
    </div>
  );
}
