import Link from "next/link";
import { site } from "@/config/site";

/**
 * Text wordmark until branding is final. The mark is a small runway marker:
 * two bars that read as a centerline, drawn in currentColor.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`} aria-label={`${site.name} home`}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
        <rect x="0" y="9" width="9" height="4" rx="1" fill="currentColor" />
        <rect x="13" y="9" width="9" height="4" rx="1" fill="var(--color-runway)" />
      </svg>
      <span className="text-lg leading-none max-[380px]:sr-only">{site.name}</span>
    </Link>
  );
}
