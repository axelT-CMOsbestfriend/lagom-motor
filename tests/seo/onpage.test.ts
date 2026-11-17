import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPage } from "../../lib/crawler";
import { auditOnPage } from "../../lib/seo/onpage";
import type { CrawlResult } from "../../lib/types";

const words = (n: number) => Array.from({ length: n }, (_, i) => `ord${i}`).join(" ");

const GOOD = `<!doctype html><html lang="sv"><head>
<title>Redovisningsbyrå i Uppsala – Exempel AB</title>
<meta name="description" content="Vi sköter bokföring, bokslut och deklaration för småföretag i Uppsala. Fast pris och personlig kontakt.">
<meta name="viewport" content="width=device-width">
<link rel="canonical" href="https://exempel.se/">
<meta property="og:image" content="https://exempel.se/og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"AccountingService","name":"Exempel AB"}</script>
</head><body><h1>Redovisning för småföretag</h1><a href="tel:+4618123456">018-12 34 56</a><img src="a.jpg" alt="Kontoret"><p>${words(400)}</p></body></html>`;

const BAD = `<!doctype html><html><head>
<meta name="robots" content="noindex">
</head><body><h1>Ett</h1><h1>Två</h1><img src="a.jpg"><p>kort text</p></body></html>`;

function crawl(pages: [string, string][], foundSitemap = true): CrawlResult {
  return {
    baseUrl: pages[0][0],
    pages: pages.map(([url, html]) => extractPage(url, html)),
    socialLinks: [],
    foundSitemap,
    errors: [],
  };
}

test("extractPage läser ut SEO-fälten", () => {
  const page = extractPage("https://exempel.se/", GOOD);
  assert.equal(page.lang, "sv");
  assert.equal(page.canonical, "https://exempel.se/");
  assert.deepEqual(page.schemaTypes, ["AccountingService"]);
  assert.equal(page.imagesWithoutAlt, 0);
});

test("en välbyggd sajt får inga anmärkningar", () => {
  const result = auditOnPage(crawl([["https://exempel.se/", GOOD]]));
  assert.deepEqual(result.issues.map((i) => i.rule), []);
  assert.equal(result.score, 100);
});

test("en dålig sida får exakt sina fel och lägre betyg", () => {
  const result = auditOnPage(crawl([["https://exempel.se/", BAD]], false));
  const rules = result.issues.map((i) => i.rule).sort();
  assert.deepEqual(
    rules,
    [
      "bilder-utan-alt", "canonical-saknas", "flera-h1", "lang-saknas", "meta-saknas",
      "noindex", "og-bild-saknas", "schema-saknas", "sitemap-saknas", "telefon-saknas",
      "titel-saknas", "tom-sida", "viewport-saknas",
    ].sort()
  );
  assert.ok(result.score < 50);
  assert.ok(result.issues.every((i) => i.fix.length > 0 && i.effortHours > 0));
});

test("samma titel på flera sidor flaggas", () => {
  const second = GOOD.replace('href="https://exempel.se/"', 'href="https://exempel.se/om"');
  const result = auditOnPage(crawl([["https://exempel.se/", GOOD], ["https://exempel.se/om", second]]));
  assert.deepEqual(result.issues.map((i) => i.rule), ["dubblett-titel"]);
});

const page = (body: string, head = "") =>
  `<!doctype html><html lang="sv"><head><title>Rörfirma i Solna – Exempel AB</title>
<meta name="description" content="Vi lagar läckor och byter blandare i Solna och Sundbyberg. Snabb hjälp och fast pris.">
<meta name="viewport" content="width=device-width">${head}</head><body><h1>Rör</h1>${body}</body></html>`;

test("en JavaScript-renderad sida med nästan ingen text flaggas som hög", () => {
  const result = auditOnPage(crawl([["https://exempel.se/", page('<div id="root"></div>', '<link rel="canonical" href="https://exempel.se/">')]]));
  const issue = result.issues.find((i) => i.rule === "tom-sida");
  assert.equal(issue?.severity, "hög");
});

test("canonical mot annan domän eller annan sida upptäcks", () => {
  const other = auditOnPage(crawl([["https://exempel.se/", page(`<p>${words(400)} 08-123 45 67</p>`, '<link rel="canonical" href="https://staging.exempel.io/">')]]));
  assert.ok(other.issues.some((i) => i.rule === "canonical-annan-doman" && i.severity === "hög"));
  const wrong = auditOnPage(crawl([["https://exempel.se/", page(`<p>${words(400)}</p>`)], ["https://exempel.se/a", page(`<p>${words(400)}</p>`, '<link rel="canonical" href="/b">')]]));
  assert.ok(wrong.issues.some((i) => i.rule === "canonical-annan-sida"));
});

test("engelsk lang på svensk text flaggas", () => {
  const html = page(`<p>Vi hjälper företag i Göteborg och Malmö med rörarbeten året runt. Det är vi som kommer till dig, och vi tar ansvar för att jobbet blir rätt gjort. ${words(300)}</p>`).replace('lang="sv"', 'lang="en"');
  assert.ok(auditOnPage(crawl([["https://exempel.se/", html]])).issues.some((i) => i.rule === "lang-fel-sprak"));
});

test("adress utan LocalBusiness-schema flaggas", () => {
  const html = page(`<p>${words(300)} Storgatan 1, 171 45 Solna. Tel 08-123 45 67</p>`, '<link rel="canonical" href="https://exempel.se/"><script type="application/ld+json">{"@type":"Organization"}</script>');
  const rules = auditOnPage(crawl([["https://exempel.se/", html]])).issues.map((i) => i.rule);
  assert.ok(rules.includes("lokalt-schema-saknas"));
  assert.ok(!rules.includes("telefon-saknas"));
});
