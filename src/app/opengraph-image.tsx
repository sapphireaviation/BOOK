import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { site } from "@/config/site";

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = join(process.cwd(), "src/server/seo/fonts");
const extraBold = readFile(join(fontDir, "Overpass-ExtraBold.ttf"));
const semiBold = readFile(join(fontDir, "Overpass-SemiBold.ttf"));

const ink = "#0e1a2b";
const paper = "#f7f9fb";
const runway = "#ffc93c";

export default async function Image() {
  return new Response(await render(), { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400, immutable" } });
}

/** Rendered once and cached: the image only changes when the brand settings do. */
async function render() {
  "use cache";
  cacheLife("max");
  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: ink, color: paper, padding: "72px 80px", fontFamily: "Overpass" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 62, height: 28, borderRadius: 6, background: paper }} />
            <div style={{ width: 62, height: 28, borderRadius: 6, background: runway }} />
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.02em" }}>{site.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.025em", maxWidth: 980 }}>{site.tagline}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 600, color: "rgba(247,249,251,0.75)" }}>
            <span>Platform fee</span>
            <span style={{ background: runway, color: ink, borderRadius: 6, padding: "4px 14px 0", fontWeight: 800 }}>0</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Overpass", data: await extraBold, style: "normal", weight: 800 },
        { name: "Overpass", data: await semiBold, style: "normal", weight: 600 },
      ],
    },
  );
  return new Uint8Array(await image.arrayBuffer());
}
