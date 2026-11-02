import * as cheerio from "cheerio";
import type { CrawlResult, CrawledPage } from "./types";

// Webbläsarlik UA – många sajter (WAF:ar) blockerar allt som ser ut som en bot,
// och analysen körs på webbplatsägarens egen begäran
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const PAGE_TIMEOUT_MS = 10_000;
const MAX_PAGES = 6;
const TEXT_EXCERPT_CHARS = 2_000;

// Undersidor som säger mest om positionering, erbjudande och konvertering
const PRIORITY_KEYWORDS = [
  "om",
  "om-oss",
  "about",
  "tjanster",
  "tjänster",
  "services",
  "produkt",
  "products",
  "priser",
  "pris",
  "pricing",
  "kontakt",
  "contact",
  "boka",
  "erbjudande",
];

const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
  "x.com",
  "twitter.com",
];

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withProto = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProto);
  return url.toString();
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} för ${url}`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("xml")) {
      throw new Error(`Oväntad content-type (${contentType}) för ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Typerna i sajtens JSON-LD, t.ex. "Organization" och "LocalBusiness"
function schemaTypes($: cheerio.CheerioAPI): string[] {
  const types = new Set<string>();
  const collect = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") types.add(t);
    if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
    if (obj["@graph"]) collect(obj["@graph"]);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collect(JSON.parse($(el).text()));
    } catch {
      // Trasig JSON-LD räknas som inget schema
    }
  });
  return [...types];
}

export function extractPage(url: string, html: string): CrawledPage {
  const $ = cheerio.load(html);
  const schema = schemaTypes($);
  const images = $("img");
  $("script, style, noscript, svg").remove();

  const text = $("body").text().replace(/\s+/g, " ").trim();

  return {
    url,
    title: $("title").first().text().trim() || null,
    metaDescription:
      $('meta[name="description"]').attr("content")?.trim() || null,
    h1: $("h1")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean),
    h2: $("h2")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean)
      .slice(0, 12),
    textExcerpt: text.slice(0, TEXT_EXCERPT_CHARS),
    wordCount: text ? text.split(" ").length : 0,
    hasViewportMeta: $('meta[name="viewport"]').length > 0,
    lang: $("html").attr("lang")?.trim() || null,
    canonical: $('link[rel="canonical"]').attr("href")?.trim() || null,
    metaRobots: $('meta[name="robots"]').attr("content")?.trim().toLowerCase() || null,
    imageCount: images.length,
    imagesWithoutAlt: images.filter((_, el) => !($(el).attr("alt") ?? "").trim()).length,
    schemaTypes: schema,
    ogImage: $('meta[property="og:image"]').attr("content")?.trim() || null,
  };
}

function collectLinks(baseUrl: URL, html: string) {
  const $ = cheerio.load(html);
  const internal = new Set<string>();
  const social = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (!/^https?:$/.test(resolved.protocol)) return;

    const host = resolved.hostname.replace(/^www\./, "");
    if (SOCIAL_HOSTS.some((s) => host === s || host.endsWith(`.${s}`))) {
      social.add(`${resolved.origin}${resolved.pathname}`);
      return;
    }
    if (resolved.hostname.replace(/^www\./, "") !== baseUrl.hostname.replace(/^www\./, "")) {
      return;
    }
    resolved.hash = "";
    resolved.search = "";
    if (/\.(pdf|jpg|jpeg|png|gif|webp|zip|mp4)$/i.test(resolved.pathname)) {
      return;
    }
    internal.add(resolved.toString());
  });

  return { internal: [...internal], social: [...social] };
}

async function urlsFromSitemap(baseUrl: URL): Promise<string[]> {
  try {
    const xml = await fetchHtml(new URL("/sitemap.xml", baseUrl).toString());
    const $ = cheerio.load(xml, { xmlMode: true });
    return $("url > loc")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((u) => {
        try {
          return (
            new URL(u).hostname.replace(/^www\./, "") ===
            baseUrl.hostname.replace(/^www\./, "")
          );
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

function rankCandidates(urls: string[], homepage: string): string[] {
  const scored = urls
    .filter((u) => u !== homepage && u !== `${homepage}/`)
    .map((u) => {
      const path = new URL(u).pathname.toLowerCase();
      const depth = path.split("/").filter(Boolean).length;
      let score = -depth; // grundare sidor först
      for (const kw of PRIORITY_KEYWORDS) {
        if (path.includes(kw)) score += 10;
      }
      return { url: u, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.url);
}

export async function crawlSite(inputUrl: string): Promise<CrawlResult> {
  const homepage = normalizeUrl(inputUrl);
  const baseUrl = new URL(homepage);
  const errors: string[] = [];

  let homeHtml: string;
  try {
    homeHtml = await fetchHtml(homepage);
  } catch (err) {
    throw new Error(
      `Kunde inte hämta startsidan (${homepage}): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const pages: CrawledPage[] = [extractPage(homepage, homeHtml)];
  const { internal, social } = collectLinks(baseUrl, homeHtml);

  const sitemapUrls = await urlsFromSitemap(baseUrl);
  const foundSitemap = sitemapUrls.length > 0;

  const candidates = rankCandidates(
    [...new Set([...sitemapUrls, ...internal])],
    homepage
  ).slice(0, MAX_PAGES - 1);

  const results = await Promise.allSettled(
    candidates.map(async (url) => extractPage(url, await fetchHtml(url)))
  );
  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      pages.push(result.value);
    } else {
      errors.push(
        `${candidates[i]}: ${
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
        }`
      );
    }
  }

  return { baseUrl: homepage, pages, socialLinks: social, foundSitemap, errors };
}
