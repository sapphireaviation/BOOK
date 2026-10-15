# Design system

The site should feel like good wayfinding: an airport sign or a road sign. Clear, calm, a little utilitarian, confident about numbers. It must not look like a generated template.

## Tokens

Defined once in `src/app/globals.css` under `@theme`. Use the Tailwind names, never raw hex in components.

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#F7F9FB` | Page background. Cool white, not cream |
| `surface` | `#FFFFFF` | Inputs, panels, popovers |
| `ink` | `#0E1A2B` | Primary text, dark sections |
| `slate` | `#5B6B7F` | Secondary text, captions |
| `line` | `#D9E0E8` | Hairlines and input borders |
| `sapphire` | `#1B3FAB` | Primary actions, links, selected states |
| `sapphire-deep` | `#132E80` | Hover and pressed for sapphire |
| `runway` | `#FFC93C` | Reserved: the zero fee line, focus rings, the selected date. Never decoration |
| `fern` | `#1F7A55` | Confirmed, available, free cancellation |
| `signal` | `#C2362F` | Errors, sold out |

Dark mode is not in launch scope. Keep tokens so it can be added.

## Type

One family: **Overpass** (Google Fonts, variable, loaded with `next/font`). It descends from Highway Gothic, the road-sign face, which fits the wayfinding idea.

- Numbers that compare (prices, times, durations) use `font-variant-numeric: tabular-nums` (`.tnum` utility).
- Scale (rem): 0.8125, 0.875, 1, 1.125, 1.375, 1.75, 2.5, 3.5, 4.75. Body is 1rem at 1.55 line height.
- Headlines: weight 800, tight tracking (-0.02em), sentence case.
- Labels: weight 600, sentence case. Never all caps. No tracked-out eyebrows.
- Line length under 75 characters for prose.

## Shape

- Inputs and buttons: 8px radius. Large media: 4px. Pills only for filter chips.
- Borders do the separating. Shadows only on things that float (popovers, sticky booking panel, toasts): `0 8px 24px -12px rgb(14 26 43 / 0.35)`.
- No gradient washes. No glassmorphism. No decorative blobs.

## Layout

- Content is left aligned. Max width 1200px, 24px gutters on mobile, 40px on desktop.
- Header: wordmark left, primary nav (Flights, Stays, List your place), account on the right. One row, 64px.
- Lists are rows separated by hairlines, not grids of identical cards.
- Flight results are timetable rows: departure time, a route line with stops marked as dots, arrival time, duration, airline, price on the right.
- Stay results: a list on the left with a wide photo per row, a sticky map on the right on desktop.

## Signature moments

Spend boldness here and keep the rest quiet:

1. **The sentence search.** The home hero is the search, written as a sentence in large type: "Fly from **Delhi** to **Goa**, leaving **Fri 24 Oct**, **1 adult**." Each bold word is a button that opens its picker. Underneath, a plain text box: "Or describe the trip".
2. **The fee line.** Every price breakdown ends with a line "Platform fee 0" where the 0 sits on a runway yellow highlight. This is the one place yellow is used as color.

## Motion

- Only in response to the user: pickers open, a selected date fills, a confirmation check draws once.
- 150 to 200ms, ease-out. Respect `prefers-reduced-motion`.
- No scroll-triggered entrances. No hover lift on rows.

## Things we do not do

- Middle dots between meta items. Use separate elements or commas.
- Arrows appended to links or buttons.
- Monospace for labels or numbers.
- Emoji in UI.
- Stock "trusted by" logo rows, fake testimonials, fake counters.
- Accenting one word of a headline in a different color or italic.

## Components

Primitives in `src/components/ui/`: `Button`, `Input`, `Field` (label, hint, error), `Select`, `Checkbox`, `Radio`, `DateRangePicker`, `Popover`, `Dialog`, `Sheet` (mobile), `Tabs`, `Toast`, `Skeleton`, `Price`, `FeeLine`, `Rating`, `Badge`.

Feature components live in `src/components/<area>/`.
