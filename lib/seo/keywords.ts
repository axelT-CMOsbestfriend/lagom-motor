import { extractJson, getClient, MODEL, summarizeCrawl, textFrom } from "../claude";
import type { SeoContext } from "./context";

// Sökordsförslag utan betald datakälla. Volymerna är Claudes uppskattning
// och märks så, för att ingen ska tro att de är uppmätta.

export interface Keyword {
  keyword: string;
  intent: "köp" | "info";
  targetPage: string;
  pageExists: boolean;
  volume: string;
}

export interface KeywordResult {
  score: number;
  keywords: Keyword[];
}

const SYSTEM = `Du är en svensk SEO-strateg. Föreslå 15–20 sökord som bolagets kunder använder på Google.

För varje sökord:
- "intent": "köp" om den som söker vill köpa/anlita, annars "info"
- "targetPage": sökvägen på sajten som ska ranka, t.ex. "/" eller "/tjanster/bokslut"
- "pageExists": true bara om en crawlad sida redan täcker sökordet
- "volume": "hög", "medel" eller "låg" – din uppskattning för Sverige

Prioritera sökord med köpavsikt och sökord där konkurrenterna syns men bolaget saknar sida.

Svara med ENDAST JSON: {"keywords": [{"keyword": "...", "intent": "köp", "targetPage": "/...", "pageExists": false, "volume": "medel"}]}`;

export async function suggestKeywords(ctx: SeoContext, competitors: string[]): Promise<KeywordResult> {
  const user = [
    `Bolag: ${ctx.companyName}`,
    ctx.location ? `Ort/marknad: ${ctx.location}` : "",
    competitors.length ? `Konkurrenter som syns i AI-svar: ${competitors.join(", ")}` : "",
    "",
    summarizeCrawl(ctx.crawl),
  ]
    .filter(Boolean)
    .join("\n");

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  const raw = extractJson<{ keywords: Keyword[] }>(textFrom(response));
  const keywords = raw.keywords.slice(0, 20).map((k) => ({
    keyword: k.keyword,
    intent: k.intent === "köp" ? ("köp" as const) : ("info" as const),
    targetPage: k.targetPage || "/",
    pageExists: Boolean(k.pageExists),
    volume: `uppskattning: ${k.volume}`,
  }));
  const covered = keywords.filter((k) => k.pageExists).length;
  return {
    score: keywords.length ? Math.round((covered / keywords.length) * 100) : 0,
    keywords,
  };
}
