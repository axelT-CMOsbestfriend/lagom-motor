import * as cheerio from "cheerio";
import type { CrawlResult, CrawledPage } from "./types";

// Webbläsarlik UA – många sajter (WAF:ar) blockerar allt som ser ut som en bot,
// och analysen körs på webbplatsägarens egen begäran
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const PAGE_TIMEOUT_MS = 10_000;
const MAX_PAGES = 8;
// Skydd mot enorma sidor som annars äter minnet
const MAX_BYTES = 5 * 1024 * 1024;
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

async function readLimited(res: Response, url: string): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new Error(`Sidan är för stor (${Math.round(declared / 1e6)} MB) för ${url}`);
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error(`Sidan är större än 5 MB för ${url}`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// Hämtar en sida och returnerar också adressen efter eventuella omdirigeringar
export async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
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
    if (!contentType.includes("html") && !contentType.includes("xml") && !contentType.includes("text/plain")) {
      throw new Error(`Oväntad content-type (${contentType}) för ${url}`);
    }
    return { html: await readLimited(res, url), finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(url: string): Promise<string> {
  return (await fetchPage(url)).html;
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
  const hasTelLink = $('a[href^="tel:"]').length > 0;
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
    // Svenska telefonnummer och postnummer, för kontroll av lokal SEO
    hasPhone: hasTelLink || /(?:\+46|\b0)[\s-]?\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2}[\s-]?\d{2}\b/.test(text),
    hasPostcode: /\b\d{3}\s?\d{2}\s+[A-ZÅÄÖ][a-zåäö]+/.test(text),
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

const sameHost = (u: string, base: URL) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
};

// Sitemaps listade i robots.txt, plus de vanliga standardadresserna
async function sitemapCandidates(baseUrl: URL): Promise<string[]> {
  const found: string[] = [];
  try {
    const robots = await fetchHtml(new URL("/robots.txt", baseUrl).toString());
    for (const line of robots.split(/\r?\n/)) {
      const m = line.match(/^\s*sitemap:\s*(\S+)/i);
      if (m) found.push(m[1]);
    }
  } catch {
    // Ingen robots.txt är vanligt och inget fel i sig
  }
  for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]) {
    found.push(new URL(path, baseUrl).toString());
  }
  return [...new Set(found)];
}

// Läser både vanliga sitemaps och sitemap-index (t.ex. WordPress och Yoast)
export async function urlsFromSitemap(baseUrl: URL): Promise<string[]> {
  for (const candidate of await sitemapCandidates(baseUrl)) {
    try {
      const xml = await fetchHtml(candidate);
      const $ = cheerio.load(xml, { xmlMode: true });
      let urls = $("url > loc").map((_, el) => $(el).text().trim()).get();
      const children = $("sitemap > loc").map((_, el) => $(el).text().trim()).get();
      for (const child of children.slice(0, 3)) {
        try {
          const $c = cheerio.load(await fetchHtml(child), { xmlMode: true });
          urls = urls.concat($c("url > loc").map((_, el) => $c(el).text().trim()).get());
        } catch {
          // En trasig undersitemap stoppar inte resten
        }
      }
      const same = urls.filter((u) => sameHost(u, baseUrl));
      if (same.length > 0 || children.length > 0) return same.length > 0 ? same : [candidate];
    } catch {
      // Prova nästa kandidat
    }
  }
  return [];
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
  const requested = normalizeUrl(inputUrl);
  const errors: string[] = [];

  let homeHtml: string;
  let homepage: string;
  try {
    // Omdirigeringar (http→https, till www eller en ny domän) följs, och
    // resten av crawlen utgår från adressen sajten faktiskt landar på
    const page = await fetchPage(requested);
    homeHtml = page.html;
    homepage = page.finalUrl;
  } catch (err) {
    throw new Error(
      `Kunde inte hämta startsidan (${requested}): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const baseUrl = new URL(homepage);
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
