# Lagom motor

Motorn bakom [Lagom Digitals](https://lagom-digital.vercel.app) digitala produkter. En AI-agent beställer en marknadsanalys med ett anrop via [MCP](https://modelcontextprotocol.io) och får tillbaka ett färdigt resultat på några minuter. Samma motor driver också en webbapp för människor.

Koden är öppen under MIT-licens. Ni kan läsa exakt hur resultaten räknas fram, köra motorn själva eller bygga vidare på den.

## Det motorn levererar

| MCP-verktyg | Levererar | Kod |
|---|---|---|
| `list_services` | Tjänsterna, leveranstid och kvar på kvoten | [lib/agent/mcp.ts](lib/agent/mcp.ts) |
| `order_health_check` | Marknadshälsokoll: styrkor och gap med källa, tre konkurrenter, plan för 30/60/90 dagar | [lib/pipeline.ts](lib/pipeline.ts), [lib/claude.ts](lib/claude.ts) |
| `order_media_plan` | Tre mediaplaner simulerade mot en syntetisk svensk panel (SCB och Mediebarometern), med motivering och risker | [lib/media/](lib/media/) |
| `order_seo_audit` | Teknisk audit mot 17 regler, laddtid, AI-synlighet, sökord och de tio viktigaste åtgärderna | [lib/seo/](lib/seo/) |
| `get_result` | Status, och när ordern är klar: `summary` i markdown och `result` som data | [lib/agent/services.ts](lib/agent/services.ts) |

## Så räknar motorn

- **SEO, teknisk del:** fasta regler utan AI i [lib/seo/onpage.ts](lib/seo/onpage.ts). Samma sajt ger alltid samma svar.
- **SEO, sökord:** volymerna är Claudes uppskattning och märks så i resultatet. Motorn köper inga sökvolymer.
- **Mediaplan:** räckvidden räknas fram ur befolkningsdata från SCB och kanalvanor från Mediebarometern ([lib/media/data/](lib/media/data/)). Reglerna som styr planerna finns i [lib/media/rules.ts](lib/media/rules.ts). Antaganden som inte kunnat kontrolleras listas i varje leverans.
- **Hälsokoll:** körs i två steg. Först letas konkurrenter upp med webbsökning, sedan skrivs analysen utifrån sajten och researchen. Varje påstående anger vad det bygger på.
- **Misslyckade jobb kostar inget:** en order som går fel eller hänger sig räknas tillbaka till kvoten ([lib/agent/services.ts](lib/agent/services.ts)).

## Koppla in en agent

Mot Lagom Digitals publicerade motor behövs en API-nyckel, som ni får [av oss](https://lagom-digital.vercel.app/kontakt):

```bash
claude mcp add --transport http lagom https://lagom-hq-motor.vercel.app/api/mcp --header "Authorization: Bearer lagom_..."
```

## Köra motorn själv

1. `npm install`
2. Skapa `.env.local` med `ANTHROPIC_API_KEY=sk-ant-...`
3. `npm run dev`, öppna http://localhost:3000
4. Skapa en nyckel: `npm run nyckel -- "Testbolag" 20`
5. Testa som en agent: `npm run mcp:test -- <nyckel> http://localhost:3000/api/mcp`

Utan Supabase sparas allt som filer i `data/`. För att publicera:

| Miljövariabel | Behövs för |
|---|---|
| `ANTHROPIC_API_KEY` | Hälsokoll, mediaplanens motivering, AI-synlighet och sökord |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Lagring på nätet. Kör [supabase/documents.sql](supabase/documents.sql) en gång |
| `PAGESPEED_API_KEY` | Valfri. Laddtidsmätning utan Googles gemensamma kvot |
| `PUBLIC_BASE_URL` | Valfri. Adressen i länkarna till webbvyn |

Motorn är byggd för Vercel. På Hobby-planen får ett serveranrop köra i 300 sekunder, därför delas långa jobb upp i flera anrop.

## Tester

```bash
npm test
```

## Licens

MIT. Se [LICENSE](LICENSE).
