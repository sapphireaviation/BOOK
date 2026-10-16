"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setSavedAction } from "@/app/(site)/stays/actions";
import { cn } from "@/components/ui";

/** Heart toggle for saving a stay. Signed out visitors are sent to sign in by the action. */
export function SaveButton({
  listingId,
  title,
  initialSaved,
  returnTo,
  className,
  showLabel = false,
}: {
  listingId: string;
  title: string;
  initialSaved: boolean;
  returnTo: string;
  className?: string;
  showLabel?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await setSavedAction(listingId, next, returnTo);
      if ("error" in result) setError(result.error);
      else setSaved(result.saved);
    });
  }

  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={optimistic}
        aria-label={showLabel ? undefined : optimistic ? `Remove ${title} from saved stays` : `Save ${title}`}
        aria-busy={pending || undefined}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm font-semibold transition-colors duration-150 hover:border-ink",
          optimistic ? "text-signal" : "text-ink",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill={optimistic ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
          <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" strokeLinejoin="round" />
        </svg>
        {showLabel && <span>{optimistic ? "Saved" : "Save"}</span>}
      </button>
      {error && (
        <span role="alert" className="mt-1 text-xs font-semibold text-signal">
          {error}
        </span>
      )}
    </span>
  );
}
