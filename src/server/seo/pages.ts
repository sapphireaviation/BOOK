/** Public pages that exist regardless of data. Used by the sitemap and the llms.txt files. */
export const staticPages = [
  { path: "/", title: "Home: search flights and stays", changeFrequency: "daily", priority: 1 },
  { path: "/flights", title: "Flights", changeFrequency: "daily", priority: 0.9 },
  { path: "/stays", title: "Stays", changeFrequency: "daily", priority: 0.9 },
  { path: "/destinations", title: "Destinations", changeFrequency: "weekly", priority: 0.7 },
  { path: "/routes", title: "Popular flight routes", changeFrequency: "weekly", priority: 0.7 },
  { path: "/how-it-works", title: "How prices work with no platform fee", changeFrequency: "monthly", priority: 0.6 },
  { path: "/help", title: "Help and frequently asked questions", changeFrequency: "monthly", priority: 0.5 },
  { path: "/hosting", title: "How hosting works", changeFrequency: "monthly", priority: 0.5 },
  { path: "/developers", title: "Public API and MCP server for AI assistants", changeFrequency: "monthly", priority: 0.5 },
  { path: "/cancellation", title: "Cancellation and refund policies", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", title: "Terms of service", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacy", title: "Privacy notice", changeFrequency: "yearly", priority: 0.2 },
] as const;

/** Paths crawlers should skip. Kept in one place so robots.txt and the proxy agree. */
export const privatePaths = ["/account", "/trips", "/saved", "/host", "/admin", "/checkout", "/bookings", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/api/"];

/** Crawlers named in docs/SEO_AND_AI.md. Listing them explicitly signals that AI search and assistants are welcome. */
export const aiCrawlers = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bingbot",
];
