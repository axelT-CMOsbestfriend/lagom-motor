import { crawlSite, normalizeUrl } from "../crawler";
import type { CrawlResult } from "../types";
import { checkAiVisibility, type AiVisibilityResult } from "./ai-visibility";
import type { SeoContext } from "./context";
import { suggestKeywords, type KeywordResult } from "./keywords";
import { auditOnPage, type OnPageResult, type Severity } from "./onpage";
import { fetchPageSpeed, type PageSpeedResult } from "./pagespeed";
import { friendlyError } from "../errors";

// Hela SEO-auditen. Delarna körs var för sig: fallerar en finns de andra
// kvar och rapporten säger vad som saknas. Bara en misslyckad crawl
// stoppar allt, eftersom ingen del går att göra utan sajten.

export type Part<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SeoAction {
  title: string;
  why: string;
  impact: number; // 1–3
  effortHours: number;
  source: "on-page" | "laddtid" | "ai-synlighet" | "nyckelord";
}

export interface SeoAudit {
  websiteUrl: string;
  companyName: string;
  overallScore: number;
  onPage: Part<OnPageResult>;
  pageSpeed: Part<PageSpeedResult>;
  aiVisibility: Part<AiVisibilityResult>;
  keywords: Part<KeywordResult>;
  actions: SeoAction[];
  summaryMarkdown: string;
}

export interface SeoDeps {
  crawl: (url: string) => Promise<CrawlResult>;
  pageSpeed: (url: string) => Promise<PageSpeedResult>;
  aiVisibility: (ctx: SeoContext) => Promise<AiVisibilityResult>;
  keywords: (ctx: SeoContext, competitors: string[]) => Promise<KeywordResult>;
}

const DEFAULT_DEPS: SeoDeps = {
  crawl: crawlSite,
  pageSpeed: fetchPageSpeed,
  aiVisibility: checkAiVisibility,
  keywords: suggestKeywords,
};

async function part<T>(fn: () => Promise<T> | T): Promise<Part<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    console.error("SEO-del misslyckades:", err);
    return { ok: false, error: friendlyError(err) };
  }
}

const VOLUME_RANK: Record<string, number> = { hög: 3, medel: 2, låg: 1 };
const MAX_KEYWORD_ACTIONS = 3;

// Köpsökord som saknar sida blir en åtgärd per målsida, inte en per sökord.
// Finns sidan redan ska den byggas ut, annars skapas. Högst tre sådana
// åtgärder, så att listan inte fylls av sökord och tränger ut tekniska fel.
export function keywordActions(keywords: KeywordResult["keywords"], existingPaths: Set<string>): SeoAction[] {
  const byPage = new Map<string, KeywordResult["keywords"]>();
  for (const k of keywords.filter((k) => !k.pageExists && k.intent === "köp")) {
    byPage.set(k.targetPage, [...(byPage.get(k.targetPage) ?? []), k]);
  }
  const volume = (k: KeywordResult["keywords"][number]) => VOLUME_RANK[k.volume.replace("uppskattning: ", "")] ?? 1;
  return [...byPage.entries()]
    .map(([page, ks]) => {
      const sorted = [...ks].sort((a, b) => volume(b) - volume(a));
      const words = sorted.slice(0, 3).map((k) => `"${k.keyword}"`).join(", ");
      const exists = existingPaths.has(page);
      const best = volume(sorted[0]);
      return {
        title: exists ? `Bygg ut sidan ${page} så att den täcker ${words}` : `Skapa sidan ${page} för ${words}`,
        why: `${ks.length} köpsökord som ingen sida på sajten täcker i dag. Volym: ${sorted[0].volume}.`,
        impact: best >= 2 ? 2 : 1,
        effortHours: exists ? 2 : 4,
        source: "nyckelord" as const,
        rank: best * 10 + ks.length,
      };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_KEYWORD_ACTIONS)
    .map(({ rank: _rank, ...action }) => action);
}

const IMPACT: Record<Severity, number> = { hög: 3, medel: 2, låg: 1 };

function buildActions(
  a: Pick<SeoAudit, "onPage" | "pageSpeed" | "aiVisibility" | "keywords">,
  existingPaths: Set<string>
): SeoAction[] {
  const actions: SeoAction[] = [];

  if (a.onPage.ok) {
    // Samma fel på flera sidor blir en åtgärd
    const byRule = new Map<string, typeof a.onPage.data.issues>();
    for (const issue of a.onPage.data.issues) byRule.set(issue.rule, [...(byRule.get(issue.rule) ?? []), issue]);
    for (const issues of byRule.values()) {
      const first = issues[0];
      actions.push({
        title: issues.length > 1 ? `${first.fix} (${issues.length} sidor)` : first.fix,
        why: first.detail,
        impact: IMPACT[first.severity],
        effortHours: Math.min(8, first.effortHours * issues.length),
        source: "on-page",
      });
    }
  }

  if (a.pageSpeed.ok) {
    for (const o of a.pageSpeed.data.opportunities) {
      actions.push({
        title: o.title,
        why: `Sparar cirka ${(o.savingsMs / 1000).toFixed(1)} s laddtid i mobilen.`,
        impact: o.savingsMs > 1000 ? 3 : 2,
        effortHours: 2,
        source: "laddtid",
      });
    }
  }

  if (a.aiVisibility.ok && a.aiVisibility.data.score < 50) {
    const top = a.aiVisibility.data.competitors.slice(0, 3).map((c) => c.name).join(", ");
    actions.push({
      title: "Bli nämnd i AI-assistenternas svar: listningar, recensioner och sidor som svarar på köpfrågorna",
      why: `Bolaget nämns i ${a.aiVisibility.data.score} % av köpfrågorna.${top ? ` I stället nämns ${top}.` : ""}`,
      impact: 3,
      effortHours: 8,
      source: "ai-synlighet",
    });
  }

  if (a.keywords.ok) actions.push(...keywordActions(a.keywords.data.keywords, existingPaths));

  return actions.sort((x, y) => y.impact / y.effortHours - x.impact / x.effortHours).slice(0, 10);
}

function scoreLine(label: string, p: Part<{ score: number }>): string {
  return p.ok ? `- **${label}:** ${p.data.score}/100` : `- **${label}:** kunde inte mätas (${p.error})`;
}

function summarize(audit: Omit<SeoAudit, "summaryMarkdown">): string {
  return [
    `# SEO-audit: ${audit.companyName}`,
    `${audit.websiteUrl} · totalt **${audit.overallScore}/100**`,
    "",
    scoreLine("Teknisk on-page", audit.onPage),
    scoreLine("Laddtid (mobil)", audit.pageSpeed),
    scoreLine("AI-synlighet", audit.aiVisibility),
    scoreLine("Nyckelordstäckning", audit.keywords),
    "",
    "## Gör det här först",
    ...audit.actions.map((a, i) => `${i + 1}. **${a.title}** (${a.effortHours} h). ${a.why}`),
  ].join("\n");
}

function guessCompanyName(crawl: CrawlResult): string {
  const title = crawl.pages[0]?.title ?? "";
  const parts = title.split(/\s+[|–—-]\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.at(-1) || new URL(crawl.baseUrl).hostname.replace(/^www\./, "");
}

export async function runSeoAudit(
  input: { websiteUrl: string; companyName?: string; location?: string },
  deps: SeoDeps = DEFAULT_DEPS
): Promise<SeoAudit> {
  const url = normalizeUrl(input.websiteUrl);
  const crawl = await deps.crawl(url);
  const ctx: SeoContext = {
    companyName: input.companyName?.trim() || guessCompanyName(crawl),
    websiteUrl: crawl.baseUrl,
    location: input.location?.trim() || null,
    crawl,
  };

  const [onPage, pageSpeed, aiAndKeywords] = await Promise.all([
    part(() => auditOnPage(crawl)),
    part(() => deps.pageSpeed(crawl.baseUrl)),
    (async () => {
      const ai = await part(() => deps.aiVisibility(ctx));
      const competitors = ai.ok ? ai.data.competitors.map((c) => c.name) : [];
      const keywords = await part(() => deps.keywords(ctx, competitors));
      return { ai, keywords };
    })(),
  ]);

  const parts = { onPage, pageSpeed, aiVisibility: aiAndKeywords.ai, keywords: aiAndKeywords.keywords };
  const scores = Object.values(parts).flatMap((p) => (p.ok ? [p.data.score] : []));
  const audit = {
    websiteUrl: crawl.baseUrl,
    companyName: ctx.companyName,
    overallScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    ...parts,
    actions: buildActions(parts, new Set(crawl.pages.map((p) => new URL(p.url).pathname.replace(/\/$/, "") || "/"))),
  };
  return { ...audit, summaryMarkdown: summarize(audit) };
}
