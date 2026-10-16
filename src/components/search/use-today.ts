"use client";

import { useSyncExternalStore } from "react";
import { localToday } from "@/lib/calendar";
import type { ISODate } from "@/lib/dates";

function subscribe(onChange: () => void) {
  // Midnight can pass while the page is open; checking every minute and on focus catches it.
  const timer = setInterval(onChange, 60_000);
  window.addEventListener("focus", onChange);
  return () => {
    clearInterval(timer);
    window.removeEventListener("focus", onChange);
  };
}

/**
 * The viewer's date, or null while rendering on the server. Reading the clock during prerender
 * is not allowed with Cache Components, and the server's date can differ from the viewer's.
 */
export function useToday(): ISODate | null {
  return useSyncExternalStore(subscribe, () => localToday(), () => null);
}
