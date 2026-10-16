"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export type MapPoint = { id: string; lat: number; lng: number; label: string; title: string; href?: string };

type Props = {
  points: MapPoint[];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Accessible name for the map region. */
  label: string;
  className?: string;
  /** Element id prefix of result rows; clicking a marker scrolls to `#<prefix><id>`. */
  rowIdPrefix?: string;
};

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Leaflet renders markers outside React, so the price label is plain HTML with Tailwind classes.
const MARKER_CLASS =
  "inline-block -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-ink bg-surface px-1.5 py-0.5 text-2xs font-bold text-ink tnum shadow-[var(--shadow-float)] group-hover:bg-ink group-hover:text-paper group-focus-visible:bg-ink group-focus-visible:text-paper";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * OpenStreetMap with price markers. Leaflet loads only when the map scrolls into view,
 * so it costs nothing on pages where nobody looks at the map.
 */
export function StayMap({ points, center, zoom = 12, label, className, rowIdPrefix }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "ready" | "failed">("idle");
  const key = JSON.stringify([points, center, zoom]);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    async function init() {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !node) return;
        map = L.map(node, { scrollWheelZoom: false, attributionControl: true });
        map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);

        for (const p of points) {
          const icon = L.divIcon({
            className: "group",
            html: `<span class="${MARKER_CLASS}">${escapeHtml(p.label)}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          const m = L.marker([p.lat, p.lng], { icon, title: p.title, alt: p.title, keyboard: true, riseOnHover: true }).addTo(map!);
          m.on("click", () => {
            if (rowIdPrefix) {
              const row = document.getElementById(`${rowIdPrefix}${p.id}`);
              if (row) {
                row.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
                row.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
                return;
              }
            }
            if (p.href) window.location.assign(p.href);
          });
        }

        if (points.length > 1) {
          map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 14 });
        } else {
          const c = points[0] ?? center;
          if (c) map.setView([c.lat, c.lng], zoom);
        }
        setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void init();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(node);

    return () => {
      cancelled = true;
      io.disconnect();
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className={className}>
      <div ref={el} role="region" aria-label={label} className="relative z-0 size-full overflow-hidden rounded-sm border border-line bg-mist font-sans">
        {state !== "ready" && (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-slate">
            {state === "failed" ? "The map could not load. The list has every place and its address." : "Loading map"}
          </p>
        )}
      </div>
    </div>
  );
}
