// Laddtid via Googles PageSpeed Insights v5. Gratis; PAGESPEED_API_KEY
// ger högre kvot men behövs inte för enstaka körningar.

export interface Vitals {
  performance: number; // 0–100
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null; // fältdata från riktiga besökare, saknas för små sajter
}

export interface PageSpeedResult {
  score: number;
  mobile: Vitals;
  desktop: Vitals;
  opportunities: { title: string; savingsMs: number }[];
}

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface Audit {
  title?: string;
  numericValue?: number;
  details?: { type?: string; overallSavingsMs?: number };
}
interface PsiResponse {
  lighthouseResult?: { categories?: { performance?: { score?: number } }; audits?: Record<string, Audit> };
  loadingExperience?: { metrics?: Record<string, { percentile?: number }> };
  error?: { message?: string };
}

async function run(url: string, strategy: "mobile" | "desktop"): Promise<PsiResponse> {
  const params = new URLSearchParams({ url, strategy, category: "performance", locale: "sv" });
  if (process.env.PAGESPEED_API_KEY) params.set("key", process.env.PAGESPEED_API_KEY);
  const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(90_000) });
  const body = (await res.json()) as PsiResponse;
  if (!res.ok || !body.lighthouseResult) {
    throw new Error(`PageSpeed svarade ${res.status}: ${body.error?.message ?? "inget resultat"}`);
  }
  return body;
}

function vitals(r: PsiResponse): Vitals {
  const audits = r.lighthouseResult?.audits ?? {};
  const inp = r.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile;
  return {
    performance: Math.round((r.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
    lcpMs: audits["largest-contentful-paint"]?.numericValue ?? null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    inpMs: inp ?? null,
  };
}

export async function fetchPageSpeed(url: string): Promise<PageSpeedResult> {
  const [mobile, desktop] = await Promise.all([run(url, "mobile"), run(url, "desktop")]);
  const opportunities = Object.values(mobile.lighthouseResult?.audits ?? {})
    .filter((a) => a.details?.type === "opportunity" && (a.details.overallSavingsMs ?? 0) > 0)
    .map((a) => ({ title: a.title ?? "Okänd åtgärd", savingsMs: Math.round(a.details!.overallSavingsMs!) }))
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 3);
  const m = vitals(mobile);
  // Mobilen väger tyngst eftersom Google rankar på mobilversionen
  return { score: m.performance, mobile: m, desktop: vitals(desktop), opportunities };
}
