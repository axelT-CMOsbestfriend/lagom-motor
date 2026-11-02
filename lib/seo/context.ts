import type { CrawlResult } from "../types";

export interface SeoContext {
  companyName: string;
  websiteUrl: string;
  location: string | null;
  crawl: CrawlResult;
}

// Bolaget räknas som nämnt om namnet eller domänen finns i det som nämns
export function mentionsCompany(ctx: SeoContext, mentioned: string[]): boolean {
  const name = ctx.companyName.toLowerCase().replace(/\s+(ab|hb|kb)$/i, "").trim();
  const domain = new URL(ctx.crawl.baseUrl).hostname.replace(/^www\./, "").toLowerCase();
  return mentioned.some((m) => {
    const s = m.toLowerCase();
    return (name.length >= 3 && s.includes(name)) || s.includes(domain);
  });
}
