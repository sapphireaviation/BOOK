"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";

export function AccountMenu() {
  const { data, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isPending) return <span className="h-9 w-20 animate-pulse rounded-md bg-mist" aria-hidden="true" />;

  if (!data) {
    return (
      <Link href="/sign-in" className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-sapphire-deep">
        Sign in
      </Link>
    );
  }

  const role = (data.user as { role?: string }).role;
  const initial = (data.user.name || data.user.email).trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface pl-1 pr-3 text-sm font-semibold hover:border-line-strong"
      >
        <span className="grid size-7 place-items-center rounded-sm bg-sapphire text-xs text-paper">{initial}</span>
        Account
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 w-56 rounded-md border border-line bg-surface py-1 shadow-[var(--shadow-float)]">
          <p className="truncate px-3 py-2 text-xs text-slate">{data.user.email}</p>
          <MenuLink href="/trips" onSelect={() => setOpen(false)}>Trips</MenuLink>
          <MenuLink href="/account" onSelect={() => setOpen(false)}>Profile</MenuLink>
          <MenuLink href="/saved" onSelect={() => setOpen(false)}>Saved stays</MenuLink>
          <MenuLink href="/host" onSelect={() => setOpen(false)}>{role === "host" ? "Host dashboard" : "List your place"}</MenuLink>
          {role === "admin" && <MenuLink href="/admin" onSelect={() => setOpen(false)}>Operations</MenuLink>}
          <div className="my-1 border-t border-line" />
          <button
            role="menuitem"
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-mist"
            onClick={async () => {
              await signOut();
              window.location.href = "/";
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, children, onSelect }: { href: string; children: React.ReactNode; onSelect: () => void }) {
  return (
    <Link role="menuitem" href={href} onClick={onSelect} className="block px-3 py-2 text-sm hover:bg-mist">
      {children}
    </Link>
  );
}
