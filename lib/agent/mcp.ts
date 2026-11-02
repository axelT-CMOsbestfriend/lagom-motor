import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { consumeQuota, refundQuota, type ApiKey } from "./keys";
import { createOrder, getOrder, type ServiceId } from "./orders";
import { orderView, runOrder, SERVICES, settleOrder, validateInput } from "./services";

// Lagom HQ som MCP-server. En ny server byggs för varje anrop, med
// den inloggade nyckeln inbyggd, så att verktygen aldrig ser andras ordrar.

type Schedule = (job: () => Promise<void>) => void;

const text = (t: string) => ({ type: "text" as const, text: t });
const fail = (message: string) => ({ isError: true, content: [text(message)] });

const INSTRUCTIONS = `Lagom HQ är en svensk marknadsbyrå för agenter. Du beställer ett färdigt resultat, inte timmar.

Så går det till:
1. Beställ med order_health_check, order_media_plan eller order_seo_audit. Du får ett order_id direkt.
2. Jobbet tar 1–4 minuter. Anropa get_result med order_id tills status är "done" eller "error". Vänta gärna 30 sekunder mellan anropen.
3. "summary" är en färdig sammanfattning i markdown att visa för människan. "result" är samma resultat som data.

Allt innehåll är på svenska. Varje beställning drar en från nyckelns kvot; misslyckas jobbet räknas den tillbaka.`;

export function buildServer(key: ApiKey, baseUrl: string, schedule: Schedule): McpServer {
  const server = new McpServer(
    { name: "lagom-hq", title: "Lagom HQ", version: "1.0.0" },
    { instructions: INSTRUCTIONS }
  );

  async function order(service: ServiceId, input: Record<string, unknown>) {
    const invalid = validateInput(service, input);
    if (invalid) return fail(`Ogiltig beställning: ${invalid}`);
    if (!(await consumeQuota(key))) {
      return fail("Kvoten för den här nyckeln är slut. Kontakta Lagom HQ för fler beställningar.");
    }
    let created;
    try {
      created = await createOrder(key.id, service, input);
    } catch (err) {
      await refundQuota(key.id);
      throw err;
    }
    schedule(() => runOrder(created.id));
    const eta = SERVICES[service].etaMinutes;
    return {
      content: [
        text(
          JSON.stringify({ order_id: created.id, status: created.status, eta_minutes: eta }) +
            `\n\nBeställningen är mottagen. Anropa get_result med order_id om cirka ${eta} minut(er).`
        ),
      ],
    };
  }

  server.registerTool(
    "list_services",
    {
      title: "Lista tjänster",
      description: "Visar Lagom HQ tjänster, vad de levererar, vilket verktyg som beställer dem och leveranstid.",
      annotations: { readOnlyHint: true },
    },
    async () => ({
      content: [
        text(
          JSON.stringify(
            {
              services: Object.entries(SERVICES).map(([id, s]) => ({ id, ...s })),
              quota: { total: key.quota, used: key.used },
            },
            null,
            2
          )
        ),
      ],
    })
  );

  server.registerTool(
    "order_health_check",
    {
      title: "Beställ Marknadshälsokoll",
      description: SERVICES.health_check.description,
      inputSchema: {
        companyName: z.string().describe("Bolagets namn"),
        websiteUrl: z.string().describe("Bolagets webbplats, t.ex. exempel.se"),
        industry: z.string().describe("Bransch, t.ex. redovisningsbyrå").default(""),
        goal: z.string().describe("Vad marknadsföringen ska åstadkomma, t.ex. fler förfrågningar från småföretag i Uppsala"),
      },
    },
    (args) => order("health_check", args)
  );

  server.registerTool(
    "order_media_plan",
    {
      title: "Beställ mediaplan",
      description: SERVICES.media_plan.description,
      inputSchema: {
        companyName: z.string().describe("Bolagets namn"),
        industry: z.string().describe("Bransch").default(""),
        goal: z.string().describe("Kampanjens mål"),
        budgetSek: z.number().int().describe("Total mediebudget i kronor, 10 000–50 000 000"),
        weeks: z.number().int().describe("Kampanjperiod i veckor, 1–52"),
        ageMin: z.number().int().describe("Målgruppens lägsta ålder"),
        ageMax: z.number().int().describe("Målgruppens högsta ålder"),
        genders: z.array(z.enum(["kvinna", "man"])).describe('Kön i målgruppen: "kvinna", "man" eller båda'),
        businessModel: z.enum(["b2c", "b2b"]).describe("b2c om bolaget säljer till konsumenter, b2b om till företag"),
      },
    },
    (args) => order("media_plan", args)
  );

  server.registerTool(
    "order_seo_audit",
    {
      title: "Beställ SEO-audit",
      description: SERVICES.seo_audit.description,
      inputSchema: {
        websiteUrl: z.string().describe("Webbplatsen som ska granskas, t.ex. exempel.se"),
        companyName: z.string().optional().describe("Bolagets namn. Gissas från sajten om det saknas."),
        location: z.string().optional().describe("Ort eller marknad, t.ex. Uppsala. Ger träffsäkrare köpfrågor."),
      },
    },
    (args) => order("seo_audit", args)
  );

  server.registerTool(
    "get_result",
    {
      title: "Hämta resultat",
      description: 'Hämtar status för en beställning. När status är "done" finns summary (markdown) och result (data).',
      inputSchema: { order_id: z.string().describe("order_id från beställningen") },
      annotations: { readOnlyHint: true },
    },
    async ({ order_id }) => {
      const found = await getOrder(order_id);
      if (!found || found.apiKeyId !== key.id) return fail(`Hittar ingen beställning med id ${order_id}.`);
      const view = orderView(await settleOrder(found), baseUrl) as { summary?: string };
      const content = [text(JSON.stringify(view, null, 2))];
      if (view.summary) content.unshift(text(view.summary));
      return { content };
    }
  );

  return server;
}
