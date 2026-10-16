import { absoluteUrl, site } from "@/config/site";
import { mcpTools } from "@/server/ai/mcp-info";
import { policies } from "@/server/rate-limit";
import { Prose, Sample, StaticPage, staticMetadata } from "../_components/static-page";

const path = "/developers";
const title = "Public API and MCP server";
const description = `Search ${site.name} flights and stays from ChatGPT, Claude, Gemini or your own code. A free MCP server and a REST API with OpenAPI 3.1. No key needed.`;

export const metadata = staticMetadata({ title: "API and MCP for AI assistants", description, path });

const perMinute = (p: { refillPerSecond: number }) => Math.round(p.refillPerSecond * 60);

export default function DevelopersPage() {
  const mcpUrl = absoluteUrl("/api/mcp");
  const openapiUrl = absoluteUrl("/openapi.json");
  return (
    <StaticPage
      title={title}
      path={path}
      jsonLd={[
        {
          "@type": "WebAPI",
          name: `${site.name} travel search API`,
          description,
          documentation: absoluteUrl(path),
          url: absoluteUrl("/api/v1"),
          provider: { "@id": absoluteUrl("/#organization") },
          termsOfService: absoluteUrl("/terms"),
        },
      ]}
      lead={
        <p>
          Assistants and apps can search {site.name} flights and stays without an API key. Use the MCP server from Claude and other MCP clients, or the
          REST API described in OpenAPI 3.1 from ChatGPT actions and your own code. Results include links where the traveler books on our website.
        </p>
      }
    >
      <Prose>
        <h2>MCP server</h2>
        <p>
          Endpoint: <a href={mcpUrl}>{mcpUrl}</a>. It speaks MCP over Streamable HTTP, needs no authentication and only reads data. A discovery file
          is at <a href={absoluteUrl("/.well-known/mcp.json")}>{absoluteUrl("/.well-known/mcp.json")}</a>.
        </p>
        <h3>Tools</h3>
        <ul>
          {Object.entries(mcpTools).map(([name, t]) => (
            <li key={name}>
              <strong>{name}</strong>: {t.description}
            </li>
          ))}
        </ul>

        <h3>Add it to Claude</h3>
        <ol>
          <li>In Claude, open Settings, then Connectors, and choose Add custom connector.</li>
          <li>Name it {site.name} and paste {mcpUrl} as the URL. Leave authentication empty.</li>
          <li>In a chat, turn the connector on and ask for a trip, for example: find a villa in Goa next weekend for 4 under ₹6,000 a night.</li>
        </ol>
        <p>From Claude Code, add it with one command:</p>
      </Prose>
      <Sample label="Terminal">{`claude mcp add --transport http ${site.shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-")} ${mcpUrl}`}</Sample>
      <Prose>
        <p>Other MCP clients that only support local servers can connect through mcp-remote:</p>
      </Prose>
      <Sample label="Client configuration">{JSON.stringify({ mcpServers: { [site.shortName.toLowerCase()]: { command: "npx", args: ["-y", "mcp-remote", mcpUrl] } } }, null, 2)}</Sample>

      <Prose>
        <h3>Add it to ChatGPT</h3>
        <ol>
          <li>Create a custom GPT and open Configure, then Actions, then Create new action.</li>
          <li>
            Choose Import from URL and paste <a href={openapiUrl}>{openapiUrl}</a>. Set authentication to None.
          </li>
          <li>Add a line to the GPT instructions such as: always give the traveler the url or bookUrl from the results so they can book.</li>
        </ol>
        <p>ChatGPT clients that support MCP connectors can use the MCP endpoint above instead.</p>

        <h2>REST API</h2>
        <p>
          The OpenAPI 3.1 description is at <a href={openapiUrl}>{openapiUrl}</a>. All endpoints are GET, return JSON and allow cross-origin requests.
          Money is an integer in minor units (paise for INR) with a currency code and a formatted text version.
        </p>
        <ul>
          <li>
            <strong>GET /api/v1/search/stays</strong>: place, checkin, checkout, adults, children, rooms, and filters for price, property type,
            amenities, free cancellation, instant booking and rating.
          </li>
          <li>
            <strong>GET /api/v1/search/flights</strong>: from, to, depart, return, adults, children, infants, cabin, and filters for stops, airlines,
            price and departure time.
          </li>
          <li>
            <strong>GET /api/v1/search/flights/offers/{"{offerId}"}</strong>: the current price and conditions of one fare.
          </li>
          <li>
            <strong>GET /api/v1/listings/{"{slug}"}</strong>: full details of one stay.
          </li>
        </ul>
        <p>
          Both search endpoints also accept <strong>q</strong>, the traveler&apos;s own sentence. It is read first and any other parameter you send
          overrides it. If something is missing, the 400 response lists what was understood and what to ask for.
        </p>
      </Prose>
      <Sample label="Search stays">{`curl "${absoluteUrl("/api/v1/search/stays")}?place=goa&checkin=2026-10-24&checkout=2026-10-27&adults=2&amenities=pool"`}</Sample>
      <Sample label="Search with a sentence">{`curl "${absoluteUrl("/api/v1/search/flights")}?q=delhi%20to%20goa%20next%20friday%20back%20sunday%202%20adults"`}</Sample>

      <Prose>
        <h2>Rate limits</h2>
        <p>Limits apply per IP address and refill continuously:</p>
        <ul>
          <li>
            REST API: bursts of up to {policies.api.capacity} requests, then {perMinute(policies.api)} a minute.
          </li>
          <li>
            MCP server: bursts of up to {policies.mcp.capacity} tool calls, then {perMinute(policies.mcp)} a minute.
          </li>
        </ul>
        <p>
          Over the limit you get status 429 with a Retry-After header in seconds. Responses also carry RateLimit-Limit and RateLimit-Remaining headers.
          If you need more, write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> and tell us what you are building.
        </p>

        <h2>Fair use</h2>
        <p>
          Show prices with their currency and send travelers to the returned links to book. Do not present our prices as your own or add fees to them.
          Fares change often, so check a fare with get_flight_offer before quoting it as final. The <a href={absoluteUrl("/terms")}>terms</a> apply.
        </p>

        <h2>For language models</h2>
        <p>
          A short index is at <a href={absoluteUrl("/llms.txt")}>{absoluteUrl("/llms.txt")}</a> and a full guide to search parameters, filters and
          policies is at <a href={absoluteUrl("/llms-full.txt")}>{absoluteUrl("/llms-full.txt")}</a>.
        </p>
      </Prose>
    </StaticPage>
  );
}
