"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui";

function remaining(expiresAt: number) {
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

/** Live hold countdown. Refreshes the page once the hold ends so the server shows the expired state. */
export function HoldCountdown({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const router = useRouter();
  const end = new Date(expiresAt).getTime();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(remaining(end));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [end]);

  useEffect(() => {
    if (left === 0) {
      const id = window.setTimeout(() => router.refresh(), 1500);
      return () => window.clearTimeout(id);
    }
  }, [left, router]);

  if (left === null) return <p className={cn("text-sm text-slate", className)}>Checking how long we can hold this for you.</p>;

  if (left === 0) {
    return (
      <p role="status" className={cn("text-sm font-semibold text-signal", className)}>
        The hold has ended. Checking whether you can still pay.
      </p>
    );
  }

  const minutes = Math.floor(left / 60);
  const seconds = String(left % 60).padStart(2, "0");
  const urgent = left < 120;
  return (
    <p className={cn("text-sm", urgent ? "font-semibold text-signal" : "text-slate", className)}>
      Held for you for{" "}
      <span role="timer" aria-live="off" className="tnum font-bold text-ink">
        {minutes}:{seconds}
      </span>
      . Pay before then to keep it.
    </p>
  );
}
