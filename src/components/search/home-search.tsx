"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { FlightSearchForm } from "./flight-search-form";
import { StaySearchForm } from "./stay-search-form";

const tabs = [
  { key: "flights", label: "Flights" },
  { key: "stays", label: "Stays" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

/**
 * The home hero: a two option switch between the flight and stay sentences.
 * Both forms stay mounted so whatever the visitor picked survives switching back and forth.
 */
export function HomeSearch() {
  const id = useId();
  const [active, setActive] = useState<TabKey>("flights");
  const refs = useRef<Record<TabKey, HTMLButtonElement | null>>({ flights: null, stays: null });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.key === active);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    setActive(tabs[next].key);
    refs.current[tabs[next].key]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="What to search" onKeyDown={onKeyDown} className="flex gap-1 border-b border-line">
        {tabs.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[t.key] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={cn(
                "relative -mb-px rounded-t-md px-4 pb-3 pt-2 text-lg font-bold transition-colors duration-150",
                selected ? "text-ink after:absolute after:inset-x-4 after:bottom-0 after:h-[3px] after:bg-sapphire" : "text-slate hover:text-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`${id}-panel-${t.key}`}
          aria-labelledby={`${id}-tab-${t.key}`}
          hidden={t.key !== active}
          className="pt-8 sm:pt-10"
        >
          {t.key === "flights" ? <FlightSearchForm layout="hero" /> : <StaySearchForm layout="hero" />}
        </div>
      ))}
    </div>
  );
}
