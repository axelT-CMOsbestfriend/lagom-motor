import { after } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { findKey } from "@/lib/agent/keys";
import { buildServer } from "@/lib/agent/mcp";

// Lagom HQ MCP. Utan sessioner: varje anrop får en egen server och
// transport, så att servern fungerar på Vercel där inget minne delas mellan anrop.

// Beställningarna körs klart i bakgrunden efter svaret, inom den här gränsen
export const maxDuration = 300;

function unauthorized() {
  return Response.json(
    { error: "Saknar eller ogiltig API-nyckel. Skicka Authorization: Bearer <nyckel>." },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="lagom-hq"' } }
  );
}

export async function POST(request: Request) {
  const raw = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const key = await findKey(raw);
  if (!key) return unauthorized();

  const origin = process.env.PUBLIC_BASE_URL ?? new URL(request.url).origin;
  const server = buildServer(key, origin, (job) =>
    after(() => job().catch((err) => console.error("Agentorder kraschade:", err)))
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// Utan sessioner finns ingen ström att öppna eller stänga
export async function GET() {
  return Response.json({ error: "Använd POST" }, { status: 405, headers: { Allow: "POST" } });
}
export const DELETE = GET;
