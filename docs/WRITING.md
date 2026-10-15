# Writing

Apply the `humanizer` skill (`.agents/skills/humanizer/SKILL.md`) to all user-facing copy and docs.

## Voice

Plain, specific, calm. Write like a helpful person at an airport information desk: short sentences, exact facts, no hype.

## Hard rules

- No em dashes or en dashes. `pnpm lint:copy` enforces this for `src/`.
- Sentence case everywhere, including buttons and headings.
- No "seamless", "effortless", "unlock", "elevate", "curated", "nestled", "hidden gem", "journey", "experience the", "discover the magic".
- No not-X-but-Y constructions. No three-item lists for rhythm.
- Buttons say what happens: "Search flights", "Pay ₹4,820", "Cancel booking". The resulting toast uses the same verb: "Booking cancelled".
- Errors say what went wrong and what to do: "That card was declined. Try another card or pay with UPI."
- Empty states invite an action: "No stays match these filters. Remove the price limit to see 14 more."
- Numbers: use the locale formatter. Dates: "Fri 24 Oct". Times: 24 hour for flights ("06:15").
- Never claim things we cannot prove (no "best price guaranteed", no "lowest fares anywhere"). Say what is true: "No platform fee. You pay the airline's fare."
