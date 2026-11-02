// npm run mcp:alla -- <nyckel> [url]
// Beställer alla tre tjänsterna samtidigt via MCP, som en kunds agent, och
// väntar på resultaten. Kostar några kronor i Claude-anrop per körning.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const [key, url = "https://lagom-hq-motor.vercel.app/api/mcp"] = process.argv.slice(2);
if (!key) {
  console.log("Användning: npm run mcp:alla -- <nyckel> [url]");
  process.exit(1);
}

const ORDERS = {
  order_seo_audit: { websiteUrl: "axeltuvemo.com", companyName: "Axel Tuvemo", location: "Stockholm" },
  order_health_check: {
    companyName: "Axel Tuvemo",
    websiteUrl: "axeltuvemo.com",
    industry: "Marknadsföring och AI-konsult",
    goal: "Få fler förfrågningar om uppdrag från bolag i Stockholm",
  },
  order_media_plan: {
    companyName: "Axel Tuvemo",
    industry: "Marknadsföring och AI-konsult",
    goal: "Bli känd bland marknadschefer i Stockholm",
    budgetSek: 100000,
    weeks: 6,
    ageMin: 30,
    ageMax: 55,
    genders: ["kvinna", "man"],
    businessModel: "b2b",
  },
};

const client = new Client({ name: "lagom-test-alla", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  })
);

const ids = {};
for (const [tool, args] of Object.entries(ORDERS)) {
  const res = await client.callTool({ name: tool, arguments: args });
  if (res.isError) throw new Error(`${tool}: ${res.content[0].text}`);
  ids[tool] = JSON.parse(res.content[0].text.split("\n")[0]).order_id;
  console.log(`✓ ${tool} beställd: ${ids[tool]}`);
}

const started = Date.now();
const done = {};
while (Object.keys(done).length < 3 && Date.now() - started < 8 * 60 * 1000) {
  await new Promise((r) => setTimeout(r, 10000));
  for (const [tool, id] of Object.entries(ids)) {
    if (done[tool]) continue;
    const res = await client.callTool({ name: "get_result", arguments: { order_id: id } });
    const view = JSON.parse(res.content.at(-1).text);
    if (view.status === "done" || view.status === "error") {
      done[tool] = view;
      const s = Math.round((Date.now() - started) / 1000);
      console.log(`${view.status === "done" ? "✓" : "✗"} ${tool} ${view.status} efter ${s} s${view.error ? `: ${view.error}` : ""}`);
    }
  }
}

for (const [tool, view] of Object.entries(done)) {
  console.log(`\n===== ${tool} =====\n${view.summary ?? view.error}`);
  if (view.web_url) console.log(`\nWebbvy: ${view.web_url}`);
}
await client.close();
