/** Minimal iCalendar (RFC 5545) writer for booking downloads. Pure, no I/O. */

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  /** Local wall clock "YYYY-MM-DDTHH:MM" plus an optional IANA zone. Without a zone the time is floating. */
  start: { local: string; timeZone?: string };
  end: { local: string; timeZone?: string };
};

export function escapeIcsText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets are folded with CRLF plus a space. */
export function foldIcsLine(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, "utf8");
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function stamp(local: string) {
  // "2026-10-24T06:15" -> "20261024T061500"
  const [d, t = "00:00"] = local.split("T");
  return `${d.replace(/-/g, "")}T${t.slice(0, 5).replace(":", "")}00`;
}

function dt(name: string, v: { local: string; timeZone?: string }) {
  return v.timeZone ? `${name};TZID=${v.timeZone}:${stamp(v.local)}` : `${name}:${stamp(v.local)}`;
}

export function buildIcs(input: { prodId: string; events: IcsEvent[]; now?: Date }) {
  const now = (input.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${input.prodId}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of input.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
      dt("DTSTART", e.start),
      dt("DTEND", e.end),
      `SUMMARY:${escapeIcsText(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${escapeIcsText(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${escapeIcsText(e.location)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
