"use client";

import { useEffect } from "react";
import { site } from "@/config/site";
import "./globals.css";

/** Replaces the root layout when it fails, so it brings its own document and keeps styling inline. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={site.defaultLocale}>
      <body style={{ margin: 0, background: "#f7f9fb", color: "#0e1a2b", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <title>{`Something went wrong | ${site.name}`}</title>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "96px 24px" }}>
          <p style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>{site.name}</p>
          <h1 style={{ fontSize: 40, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "32px 0 0" }}>The site did not load</h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: "#5b6b7f", marginTop: 16 }}>
            Something failed on our side. Try again in a moment. If it keeps happening, write to{" "}
            <a href={`mailto:${site.supportEmail}`} style={{ color: "#1b3fab" }}>
              {site.supportEmail}
            </a>
            .
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, height: 44, padding: "0 20px", borderRadius: 8, border: 0, background: "#1b3fab", color: "#f7f9fb", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
