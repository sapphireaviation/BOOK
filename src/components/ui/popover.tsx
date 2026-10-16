"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

const SHEET_QUERY = "(max-width: 639px)";

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", cb);
    return () => mql.removeEventListener("change", cb);
  };
}

/** True below 640px, where popovers become bottom sheets. False during server render. */
export function useSheetLayout() {
  const subscribe = useCallback((cb: () => void) => subscribeMedia(SHEET_QUERY)(cb), []);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false,
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest("[inert]") && el.getClientRects().length > 0);
}

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /** The control that opened the popover. Focus returns here on close. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Accessible name of the dialog, also the sheet heading on small screens. */
  label: string;
  /** Element to focus on open. Defaults to the first focusable element. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  children: React.ReactNode;
};

/**
 * A floating panel anchored to a control. Focus moves in on open and back to the anchor on close.
 * Escape, a click outside, or tabbing past the ends keeps focus contained and closes it as expected.
 * Under 640px it renders as a bottom sheet with a backdrop.
 */
export function Popover({ open, onClose, anchorRef, label, initialFocusRef, className, children }: PopoverProps) {
  const sheet = useSheetLayout();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  // Position next to the anchor on wider screens, flipping above when there is no room below.
  useLayoutEffect(() => {
    if (!open || sheet) return;
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const a = anchor.getBoundingClientRect();
      const w = panel.offsetWidth;
      const h = panel.scrollHeight;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const gap = 8;
      const below = vh - a.bottom - gap * 2;
      const above = a.top - gap * 2;
      const flip = h > below && above > below;
      const maxHeight = Math.max(200, flip ? above : below);
      const top = flip ? Math.max(gap, a.top - gap - Math.min(h, maxHeight)) : a.bottom + gap;
      const left = Math.min(Math.max(gap, a.left), Math.max(gap, vw - w - gap));
      setPos({ top, left, maxHeight });
    };
    place();
    const ro = new ResizeObserver(place);
    if (panelRef.current) ro.observe(panelRef.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, sheet, anchorRef]);

  // Focus in on open, back to the anchor on close.
  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    // Content may already have placed focus (the calendar focuses its selected day).
    if (!panel?.contains(document.activeElement)) {
      const target = initialFocusRef?.current ?? (panel ? focusables(panel)[0] : null) ?? panel;
      target?.focus({ preventScroll: true });
    }
    return () => {
      const active = document.activeElement;
      if (!active || active === document.body || panel?.contains(active)) anchor?.focus({ preventScroll: true });
    };
  }, [open, anchorRef, initialFocusRef]);

  // Outside clicks close. Clicks on the anchor are left to the anchor, which toggles.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onCloseRef.current();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, anchorRef]);

  // The sheet is modal: stop the page behind it from scrolling.
  useEffect(() => {
    if (!open || !sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, sheet]);

  if (!open || typeof document === "undefined") return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = focusables(panelRef.current);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const panel = sheet ? (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn("relative flex max-h-[88dvh] animate-sheet-up flex-col rounded-t-lg bg-surface text-base font-normal tracking-normal text-ink shadow-[var(--shadow-float)] outline-none", className)}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
          <p className="text-lg font-bold">{label}</p>
          <button type="button" onClick={onClose} className="-mr-2 rounded-md px-3 py-2 text-sm font-semibold text-sapphire hover:bg-mist">
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  ) : (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={pos ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight } : { top: 0, left: 0, opacity: 0 }}
      className={cn(
        "fixed z-50 animate-pop-in overflow-y-auto rounded-md border border-line bg-surface text-base font-normal tracking-normal text-ink shadow-[var(--shadow-float)] outline-none",
        className,
      )}
    >
      {children}
    </div>
  );

  return createPortal(panel, document.body);
}
