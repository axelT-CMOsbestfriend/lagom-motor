// npm run mcp:test -- <nyckel> [url]
// Kopplar upp en riktig MCP-klient mot Lagom HQ, som en kunds agent
// skulle göra, och beställer en SEO-audit av axeltuvemo.com.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import assert from "node:assert/strict";

const [key, url = "http://localhost:3010/api/mcp"] = process.argv.slice(2);
if (!key) {
  console.log("Användning: npm run mcp:test -- <nyckel> [url]");
  process.exit(1);
}

// 1. Utan nyckel ska servern svara 401
const anon = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
assert.equal(anon.status, 401);
console.log("✓ utan nyckel: 401");

// 2. Med nyckel: lista verktygen
const client = new Client({ name: "lagom-test", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  })
);
const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
assert.deepEqual(names, ["get_result", "list_services", "order_health_check", "order_media_plan", "order_seo_audit"]);
console.log(`✓ verktyg: ${names.join(", ")}`);

// 3. Ogiltig beställning avvisas utan att kosta kvot
const bad = await client.callTool({ name: "order_seo_audit", arguments: { websiteUrl: "" } });
assert.equal(bad.isError, true);
console.log(`✓ ogiltig beställning: ${bad.content[0].text}`);

// 4. Beställ och vänta på resultatet
const ordered = await client.callTool({
  name: "order_seo_audit",
  arguments: { websiteUrl: "axeltuvemo.com", companyName: "Axel Tuvemo", location: "Stockholm" },
});
const { order_id } = JSON.parse(ordered.content[0].text.split("\n")[0]);
console.log(`✓ beställd: ${order_id}`);

const started = Date.now();
let view;
while (Date.now() - started < 6 * 60 * 1000) {
  const res = await client.callTool({ name: "get_result", arguments: { order_id } });
  view = JSON.parse(res.content.at(-1).text);
  if (view.status === "done" || view.status === "error") break;
  process.stdout.write(`  ${view.status}…\n`);
  await new Promise((r) => setTimeout(r, 5000));
}
assert.equal(view.status, "done", view.error);
console.log(`✓ klar efter ${Math.round((Date.now() - started) / 1000)} s, totalt ${view.result.overallScore}/100\n`);
console.log(view.summary);

// 5. Någon annans order syns inte
const other = await client.callTool({ name: "get_result", arguments: { order_id: "ord_finnsinte000000" } });
assert.equal(other.isError, true);
console.log("\n✓ okänd order: avvisad");
await client.close();
