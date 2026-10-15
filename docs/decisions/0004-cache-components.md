# 0004: Keep Cache Components on

Status: accepted, 2026-10-15

Next.js 16.4 scaffolds with `cacheComponents` and `partialPrefetching` enabled. We keep both: the static shell gives fast first paint on every page, which helps Core Web Vitals and therefore search ranking. The cost is discipline about `<Suspense>` boundaries around request data, documented in `AGENTS.md`.
