import Anthropic from "@anthropic-ai/sdk";
import type {
  AnalysisRecord,
  Brief,
  CompetitorResearch,
  CrawlResult,
  HealthCheck,
} from "./types";

export const MODEL = "claude-sonnet-5";

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY saknas. Skapa .env.local med ANTHROPIC_API_KEY=sk-ant-..."
    );
  }
  return new Anthropic();
}

export function textFrom(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Modellen skriver ibland en rå radbrytning eller tabb inuti en textsträng,
// vilket är ogiltig JSON. Sådana tecken görs om till escape-sekvenser, men
// bara inuti strängar, så att resten av svaret lämnas orört.
function escapeControlCharsInStrings(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (inString && !escaped && ch < " ") {
      out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t" : `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
      continue;
    }
    if (ch === '"' && !escaped) inString = !inString;
    escaped = inString && !escaped && ch === "\\";
    out += ch;
  }
  return out;
}

export function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Modellen returnerade inget giltigt JSON-svar");
  }
  const json = text.slice(start, end + 1);
  try {
    return JSON.parse(json) as T;
  } catch {
    return JSON.parse(escapeControlCharsInStrings(json)) as T;
  }
}

export async function generateFollowUpQuestions(
  brief: Omit<Brief, "followUps">
): Promise<string[]> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "Du är en erfaren svensk marknadschef (CMO) som onboardar en ny kund. " +
      "Utifrån kundens första uppgifter ställer du de 3–4 följdfrågor som ger mest värde " +
      "för en träffsäker marknadsanalys – som en CMO skulle göra på ett första möte. " +
      "Frågorna ska vara korta, konkreta och gå att besvara i fritext (t.ex. om målgrupp, " +
      "geografi, vad som gör dem unika, nuvarande kanaler eller budget). " +
      'Svara med ENDAST JSON: {"questions": ["fråga 1", "fråga 2", ...]}',
    messages: [
      {
        role: "user",
        content: `Företag: ${brief.companyName}\nWebbplats: ${brief.websiteUrl}\nBransch: ${brief.industry}\nMål: ${brief.goal}`,
      },
    ],
  });
  const parsed = extractJson<{ questions: string[] }>(textFrom(response));
  return parsed.questions.slice(0, 4);
}

// Ett anrop med webbsök som får fortsätta när servern pausar turen
// (pause_turn), och som till sist tolkas som JSON
export async function askJsonWithWebSearch<T>(
  system: string,
  userContent: string,
  maxSearches: number
): Promise<T> {
  const client = getClient();
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: userContent }];
  let response: Anthropic.Message;
  let continuations = 0;
  do {
    response = await client.messages
      .stream({
        model: MODEL,
        max_tokens: 16000,
        system,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxSearches }],
        messages,
      })
      .finalMessage();
    if (response.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: response.content }];
      continuations++;
    }
  } while (response.stop_reason === "pause_turn" && continuations < 5);
  return extractJson<T>(textFrom(response));
}

export function summarizeCrawl(crawl: CrawlResult): string {
  const pages = crawl.pages
    .map((p) =>
      [
        `URL: ${p.url}`,
        `Titel: ${p.title ?? "(saknas)"}`,
        `Meta-beskrivning: ${p.metaDescription ?? "(saknas)"}`,
        `H1: ${p.h1.join(" | ") || "(saknas)"}`,
        `H2: ${p.h2.join(" | ") || "(saknas)"}`,
        `Mobilanpassning (viewport-meta): ${p.hasViewportMeta ? "ja" : "nej"}`,
        `Ordantal: ${p.wordCount}`,
        `Textutdrag: ${p.textExcerpt.slice(0, 1500)}`,
      ].join("\n")
    )
    .join("\n\n---\n\n");

  return [
    `Webbplats: ${crawl.baseUrl}`,
    `Sitemap hittad: ${crawl.foundSitemap ? "ja" : "nej"}`,
    `Sociala kanaler länkade från sajten: ${
      crawl.socialLinks.length > 0 ? crawl.socialLinks.join(", ") : "inga hittade"
    }`,
    crawl.errors.length > 0
      ? `Sidor som inte kunde hämtas: ${crawl.errors.join("; ")}`
      : "",
    "",
    "CRAWLADE SIDOR:",
    pages,
  ]
    .filter(Boolean)
    .join("\n");
}

const HEALTH_CHECK_SYSTEM = `Du är en erfaren svensk marknadschef (CMO) och varumärkesstrateg med 15 års erfarenhet av småföretag. Du gör ett "Marknadshälsokoll" – en gap-analys av ett företags marknadsföring.

REGLER:
- Basera ALLT på det faktiska underlaget (crawldata + brief + konkurrentresearch). Inga generiska råd.
- Varje styrka och gap MÅSTE referera till en konkret observation i "source"-fältet (t.ex. "startsidan saknar meta-beskrivning", "inga kundcase på sajten", "konkurrent X rankar på 'begrepp Y'").
- Skriv på begriplig svenska utan byråjargong. Förklara alltid VARFÖR något spelar roll, som en tålmodig kollega.
- Konkurrenterna kommer från KONKURRENTRESEARCH i underlaget, som redan är gjord med webbsökning. Hitta inte på andra konkurrenter.
- Handlingsplanen ska vara prioriterad: 30 dagar = snabba grundläggande fixar, 60 dagar = bygga närvaro, 90 dagar = tillväxt/mätning. 3–4 punkter per period, konkreta uppgifter ("gör detta"), med motivering.

Svara med ENDAST giltig JSON enligt exakt detta schema (inga kodblock, ingen text före/efter):
{
  "summary": "2-3 meningar som sammanfattar läget, personligt och konkret",
  "strengths": [{"title": "...", "detail": "...", "source": "vad observationen bygger på"}],
  "gaps": [{"title": "...", "detail": "vad som saknas", "why": "varför det spelar roll för målet", "source": "vad observationen bygger på"}],
  "competitors": [{"name": "...", "url": "...", "overview": "hur de jobbar med kanaler/innehåll/positionering", "theirEdge": "vad de gör bättre", "yourOpening": "lucka kunden kan utnyttja"}],
  "plan": [
    {"period": "30", "items": [{"heading": "kort uppgiftsrubrik", "detail": "konkret vad som ska göras", "why": "varför just detta först"}]},
    {"period": "60", "items": [...]},
    {"period": "90", "items": [...]}
  ]
}

3-5 styrkor, 3-5 gaps, exakt 3 konkurrenter, 3-4 planpunkter per period.`;

function briefText(brief: Brief): string {
  const followUps = brief.followUps
    .map((f) => `F: ${f.question}\nS: ${f.answer}`)
    .join("\n");
  return [
    "BRIEF FRÅN KUNDEN:",
    `Företag: ${brief.companyName}`,
    `Bransch: ${brief.industry}`,
    `Mål: ${brief.goal}`,
    followUps ? `Följdfrågor och svar:\n${followUps}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const RESEARCH_SYSTEM = `Du är researcher åt en svensk marknadschef. Sök på webben efter de 3 mest relevanta konkurrenterna till bolaget nedan: samma bransch och samma geografi eller segment. Skaffa en översiktlig bild av hur var och en jobbar med kanaler, innehåll och positionering.

Svara med ENDAST JSON: {"competitors": [{"name": "...", "url": "...", "notes": "3-5 meningar om hur de jobbar och vad som syns på deras sajt"}]}`;

// Steg 1 av hälsokollet: konkurrentresearch med webbsökning. Hälsokollet
// körs i två steg eftersom webbsökning plus analys i ett anrop kan ta över
// 300 sekunder, som är taket för en serverfunktion på Vercels Hobby-plan.
export async function researchCompetitors(
  brief: Brief,
  crawl: CrawlResult
): Promise<CompetitorResearch> {
  const crawlBrief = summarizeCrawl({ ...crawl, pages: crawl.pages.slice(0, 2) });
  return askJsonWithWebSearch<CompetitorResearch>(
    RESEARCH_SYSTEM,
    `${briefText(brief)}\n\nKUNDENS WEBBPLATS (UTDRAG):\n${crawlBrief}`,
    5
  );
}

// Steg 2: själva hälsokollet, utan webbsökning, byggt på crawl och research
export async function runHealthCheck(
  brief: Brief,
  crawl: CrawlResult,
  research: CompetitorResearch
): Promise<HealthCheck> {
  const userContent = [
    briefText(brief),
    "",
    "CRAWLDATA FRÅN KUNDENS WEBBPLATS:",
    summarizeCrawl(crawl),
    "",
    "KONKURRENTRESEARCH:",
    JSON.stringify(research.competitors, null, 2),
    "",
    "Gör Marknadshälsokollet nu.",
  ].join("\n");

  const response = await getClient()
    .messages.stream({
      model: MODEL,
      max_tokens: 32000,
      system: HEALTH_CHECK_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    })
    .finalMessage();
  return extractJson<HealthCheck>(textFrom(response));
}

const CHAT_FREE_QUESTION_LIMIT = 3;
export { CHAT_FREE_QUESTION_LIMIT };

// Den kompakta bild av mediaplanen som chatten får. Kurvan, prickarna och
// panelen skickas inte med, bara planerna vid den valda budgeten.
function mediaPlanContext(record: AnalysisRecord): string | null {
  const mp = record.mediaPlan;
  if (!mp?.view) return null;
  return JSON.stringify({
    forutsattningar: mp.input,
    rekommenderadPlan: mp.explanation?.recommendedPlanId ?? null,
    sammanfattning: mp.explanation?.summary ?? null,
    planer: mp.view.plans.map((p) => ({
      id: p.id,
      namn: p.name,
      rackviddAv100: Math.round(p.reach.mid * 100),
      kanaler: p.channels.map((c) => ({ kanal: c.label, kr: c.budgetSek })),
    })),
  });
}

export function cmoSystemPrompt(record: AnalysisRecord): string {
  const mediaPlan = mediaPlanContext(record);
  const lines = [
    "Du är kundens personliga marknadschef (AI-CMO) i tjänsten Marknadspiloten – en tålmodig, kunnig kollega att bolla marknadsföring med.",
    "Du har redan gjort ett Marknadshälsokoll för kunden. Använd det som grund och referera till konkreta observationer ur det.",
  ];
  if (mediaPlan) {
    lines.push(
      "Du har också tagit fram en mediaplan. Svarar du på frågor om den, använd bara siffrorna i MEDIAPLANEN och hitta inte på nya."
    );
  }
  lines.push(
    "Svara på begriplig svenska utan byråjargong, förklara varför, och håll svaren fokuserade (max ~200 ord).",
    "",
    `KUNDENS BRIEF: ${JSON.stringify(record.brief)}`,
    `MARKNADSHÄLSOKOLLET: ${JSON.stringify(record.healthCheck)}`
  );
  if (mediaPlan) lines.push(`MEDIAPLANEN: ${mediaPlan}`);
  return lines.join("\n");
}

export async function chatWithCmo(
  record: AnalysisRecord,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: cmoSystemPrompt(record),
    messages,
  });
  return textFrom(response);
}
