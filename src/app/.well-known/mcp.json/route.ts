import { absoluteUrl, site } from "@/config/site";
import { mcpInstructions, mcpTools } from "@/server/ai/mcp-info";

/** Discovery hint for MCP clients and crawlers: where the server is and what it offers. */
export function GET() {
  const endpoint = absoluteUrl("/api/mcp");
  return Response.json(
    {
      name: site.name,
      title: `${site.name} flights and stays`,
      description: mcpInstructions,
      version: "1.0.0",
      url: endpoint,
      transport: "streamable-http",
      endpoints: { streamableHttp: endpoint },
      authentication: { type: "none" },
      capabilities: { tools: true, resources: false, prompts: false },
      tools: Object.entries(mcpTools).map(([name, t]) => ({ name, title: t.title, description: t.description })),
      documentation: absoluteUrl("/developers"),
      openapi: absoluteUrl("/openapi.json"),
      llms: absoluteUrl("/llms.txt"),
      contact: site.supportEmail,
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } },
  );
}
