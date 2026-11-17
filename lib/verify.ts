import { z } from "zod";
import type { CompetitorResearch, CrawlResult, HealthCheck } from "./types";

// Kontroller som körs på modellens svar innan ett hälsokoll räknas som klart.
// Målet: inga påhittade konkurrenter och inga påståenden utan spårbar källa.

const competitorResearchSchema = z.object({
  competitors: z
    .array(z.object({ name: z.string().min(1), url: z.string().min(1), notes: z.string() }))
    .min(1),
});

const sourced = { title: z.string().min(1), detail: z.string().min(1), source: z.string().min(1) };

const healthCheckSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.object(sourced)).min(1),
  gaps: z.array(z.object({ ...sourced, why: z.string().min(1) })).min(1),
  competitors: z.array(
    z.object({
      name: z.string().min(1),
      url: z.string().min(1),
      overview: z.string(),
      theirEdge: z.string(),
      yourOpening: z.string(),
    })
  ),
  plan: z
    .array(
      z.object({
        period: z.enum(["30", "60", "90"]),
        items: z
          .array(z.object({ heading: z.string().min(1), detail: z.string().min(1), why: z.string().min(1) }))
          .min(1),
      })
    )
    .length(3),
});

export function parseCompetitorResearch(data: unknown): CompetitorResearch {
  return competitorResearchSchema.parse(data);
}

export function parseHealthCheck(data: unknown): HealthCheck {
  return healthCheckSchema.parse(data) as HealthCheck;
}

export function hostOf(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function reachable(url: string, fetcher: Fetcher): Promise<boolean> {
  const target = url.startsWith("http") ? url : `https://${url}`;
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetcher(target, { method, redirect: "follow", signal: AbortSignal.timeout(8000) });
      if (res.status < 400) return true;
      // Vissa sajter svarar 403/405 på HEAD men fungerar med GET
      if (method === "GET") return false;
    } catch {
      if (method === "GET") return false;
    }
  }
  return false;
}

// Behåller bara konkurrenter vars sajt svarar, som inte är kunden själv och
// som inte förekommer två gånger
export async function verifyCompetitors(
  research: CompetitorResearch,
  customerUrl: string,
  fetcher: Fetcher = fetch
): Promise<{ research: CompetitorResearch; dropped: string[] }> {
  const customerHost = hostOf(customerUrl);
  const seen = new Set<string>();
  const dropped: string[] = [];
  const kept: CompetitorResearch["competitors"] = [];
  for (const c of research.competitors) {
    const host = hostOf(c.url);
    if (!host || host === customerHost || seen.has(host)) {
      dropped.push(`${c.name} (ogiltig eller dubblett)`);
      continue;
    }
    if (!(await reachable(c.url, fetcher))) {
      dropped.push(`${c.name} (sajten svarar inte)`);
      continue;
    }
    seen.add(host);
    kept.push(c);
  }
  return { research: { competitors: kept }, dropped };
}

// En källa räknas som spårbar om den nämner en crawlad sida, en verifierad
// konkurrent eller kundens egen brief. Allt annat flaggas.
export function isGroundedSource(source: string, crawl: CrawlResult, research: CompetitorResearch): boolean {
  const s = source.toLowerCase();
  if (/\bbrief\b|kundens svar|följdfråg/.test(s)) return true;
  for (const page of crawl.pages) {
    const path = (() => {
      try {
        return new URL(page.url).pathname.toLowerCase();
      } catch {
        return "";
      }
    })();
    if (s.includes(page.url.toLowerCase())) return true;
    if (path && path !== "/" && s.includes(path)) return true;
    if ((path === "/" || path === "") && /startsidan|förstasidan|hemsidan/.test(s)) return true;
  }
  for (const c of research.competitors) {
    const host = hostOf(c.url);
    if (s.includes(c.name.toLowerCase()) || (host && s.includes(host))) return true;
  }
  return false;
}

export interface GroundingReport {
  ungrounded: string[];
  inventedCompetitors: string[];
}

// Rensar hälsokollet: konkurrenter som inte fanns i researchen tas bort, och
// påståenden utan spårbar källa listas så att de kan göras om eller flaggas
export function groundHealthCheck(
  hc: HealthCheck,
  crawl: CrawlResult,
  research: CompetitorResearch
): { healthCheck: HealthCheck; report: GroundingReport } {
  const known = new Set(research.competitors.map((c) => hostOf(c.url)));
  const inventedCompetitors: string[] = [];
  const competitors = hc.competitors.filter((c) => {
    const ok = known.has(hostOf(c.url));
    if (!ok) inventedCompetitors.push(c.name);
    return ok;
  });
  const ungrounded = [...hc.strengths, ...hc.gaps]
    .filter((item) => !isGroundedSource(item.source, crawl, research))
    .map((item) => item.title);
  return { healthCheck: { ...hc, competitors }, report: { ungrounded, inventedCompetitors } };
}
