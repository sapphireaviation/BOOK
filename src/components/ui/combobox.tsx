"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "./cn";
import { inputClass } from "./field";

/** Splits `text` around the first case-insensitive match of `query`, preferring a match at a word start. */
export function splitMatch(text: string, query: string): { before: string; match: string; after: string } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const lower = text.toLowerCase();
  let at = -1;
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, i + 1)) {
    if (i === 0 || /[\s,(/-]/.test(lower[i - 1])) {
      at = i;
      break;
    }
    if (at === -1) at = i;
  }
  if (at === -1) return null;
  return { before: text.slice(0, at), match: text.slice(at, at + q.length), after: text.slice(at + q.length) };
}

/** Renders text with the part that matches the query in heavier weight. */
export function HighlightMatch({ text, query }: { text: string; query: string }) {
  const parts = splitMatch(text, query);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.before}
      <mark className="bg-transparent font-extrabold text-inherit">{parts.match}</mark>
      {parts.after}
    </>
  );
}

type Status = "idle" | "loading" | "ready" | "error";

export type ComboboxProps<T> = {
  label: string;
  placeholder?: string;
  /** Loads options for a query. Called after a short pause in typing; the signal aborts stale requests. */
  fetchOptions: (query: string, signal: AbortSignal) => Promise<T[]>;
  getKey: (item: T) => string;
  /** Plain text for an option, used for the screen reader count and as a fallback. */
  getText: (item: T) => string;
  renderOption?: (item: T, query: string) => React.ReactNode;
  onSelect: (item: T) => void;
  /** Shown under the input before anything is typed. */
  hint?: string;
  /** Message when a query returns nothing. */
  emptyMessage?: (query: string) => string;
  /** Extra option appended to results, for example "Search for 'xyz'" free text. */
  extraOption?: (query: string) => T | null;
  minChars?: number;
  debounceMs?: number;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
};

/**
 * Text input with a list of suggestions, following the WAI-ARIA combobox pattern (list autocomplete).
 * Arrow keys move through options, Enter picks one, the count is announced politely.
 */
export function Combobox<T>({
  label,
  placeholder,
  fetchOptions,
  getKey,
  getText,
  renderOption,
  onSelect,
  hint,
  emptyMessage = () => "Nothing matches. Check the spelling or try a nearby city.",
  extraOption,
  minChars = 1,
  debounceMs = 180,
  inputRef,
  className,
}: ComboboxProps<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const statusId = `${id}-status`;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const fetchRef = useRef(fetchOptions);
  useEffect(() => {
    fetchRef.current = fetchOptions;
  });

  const trimmed = query.trim();
  const enough = trimmed.length >= minChars;

  useEffect(() => {
    if (!enough) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const items = await fetchRef.current(trimmed, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setResults(items);
        setActive(items.length ? 0 : -1);
        setStatus("ready");
      } catch {
        if (ctrl.signal.aborted) return;
        setResults([]);
        setActive(-1);
        setStatus("error");
      }
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [trimmed, enough, debounceMs, attempt]);

  const extra = enough && status !== "loading" && extraOption ? extraOption(trimmed) : null;
  const options = enough ? (extra ? [...results, extra] : results) : [];
  const expanded = options.length > 0;
  const activeIndex = active >= options.length ? options.length - 1 : active;

  // Keep the highlighted option visible while arrowing through a long list.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${id}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, id]);

  const pick = (item: T) => {
    onSelect(item);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      // Never submit the surrounding form from inside a picker.
      e.preventDefault();
      if (activeIndex >= 0 && options[activeIndex]) pick(options[activeIndex]);
    }
  };

  let message: React.ReactNode = null;
  if (!enough) message = hint ?? null;
  else if (status === "loading" && !results.length) message = "Looking";
  else if (status === "error")
    message = (
      <>
        Suggestions did not load. Check your connection,{" "}
        <button type="button" className="link font-semibold" onClick={() => setAttempt((n) => n + 1)}>
          then try again
        </button>
        .
      </>
    );
  else if (status === "ready" && !results.length && !extra) message = emptyMessage(trimmed);

  const announcement =
    !enough || status === "loading"
      ? ""
      : status === "error"
        ? "Suggestions did not load."
        : results.length
          ? `${results.length} ${results.length === 1 ? "suggestion" : "suggestions"}. Use the up and down arrows to choose.`
          : emptyMessage(trimmed);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <label htmlFor={`${id}-input`} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
        aria-describedby={statusId}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          if (e.target.value.trim().length < minChars) {
            setResults([]);
            setStatus("idle");
          }
        }}
        onKeyDown={onKeyDown}
        className={cn(inputClass, "mt-1.5")}
      />
      <p id={statusId} className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <ul id={listId} role="listbox" aria-label={label} className={cn("mt-2 min-h-0 overflow-y-auto", !expanded && "hidden")}>
        {options.map((item, i) => (
          <li
            key={getKey(item)}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === activeIndex}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => pick(item)}
            onPointerMove={() => i !== activeIndex && setActive(i)}
            className={cn(
              "cursor-pointer rounded-md px-3 py-2.5 text-ink",
              i === activeIndex ? "bg-sapphire-wash outline outline-1 outline-sapphire/30" : "hover:bg-mist",
            )}
          >
            {renderOption ? renderOption(item, trimmed) : <HighlightMatch text={getText(item)} query={trimmed} />}
          </li>
        ))}
      </ul>
      {message && <p className="mt-3 text-sm text-slate">{message}</p>}
    </div>
  );
}
