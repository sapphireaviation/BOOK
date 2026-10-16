"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { CircleMarker, Map as LeafletMap } from "leaflet";

type Point = { lat: number; lng: number };

/** India as the opening view when a listing has no pin yet. */
const DEFAULT_VIEW: { center: [number, number]; zoom: number } = { center: [21.5, 79], zoom: 4 };

/**
 * Click to drop a pin. OpenStreetMap tiles through Leaflet. The latitude and longitude
 * inputs next to the map are the keyboard way to set the same point.
 */
export function MapPicker({ point, onPick, label }: { point: Point | null; onPick: (p: Point) => void; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const pick = useRef(onPick);
  const initial = useRef(point);

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (cancelled || !el.current || map.current) return;
      const css = getComputedStyle(document.documentElement);
      const color = css.getPropertyValue("--color-sapphire").trim() || "currentColor";
      const ring = css.getPropertyValue("--color-surface").trim() || "white";
      const start = initial.current;
      const m = L.map(el.current, { scrollWheelZoom: false, attributionControl: true }).setView(start ? [start.lat, start.lng] : DEFAULT_VIEW.center, start ? 15 : DEFAULT_VIEW.zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      marker.current = L.circleMarker(start ? [start.lat, start.lng] : DEFAULT_VIEW.center, {
        radius: 9,
        color: ring,
        weight: 3,
        fillColor: color,
        fillOpacity: 1,
        opacity: start ? 1 : 0,
        fill: Boolean(start),
      }).addTo(m);
      m.on("click", (e) => {
        const p = { lat: round(e.latlng.lat), lng: round(e.latlng.lng) };
        pick.current(p);
      });
      map.current = m;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  // Keep the pin in step with the inputs.
  useEffect(() => {
    if (!map.current || !marker.current || !point) return;
    marker.current.setLatLng([point.lat, point.lng]);
    marker.current.setStyle({ opacity: 1, fill: true });
    if (!map.current.getBounds().pad(-0.2).contains([point.lat, point.lng])) map.current.panTo([point.lat, point.lng]);
  }, [point]);

  return <div ref={el} role="application" aria-label={label} className="relative z-0 h-80 w-full overflow-hidden rounded-sm border border-line bg-mist md:h-96" />;
}

/** Six decimals is about 10 cm, plenty for a front door. */
export function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}
