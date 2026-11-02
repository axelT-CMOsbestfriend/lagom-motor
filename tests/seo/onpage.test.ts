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
</head><body><h1>Redovisning för småföretag</h1><img src="a.jpg" alt="Kontoret"><p>${words(400)}</p></body></html>`;

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
      "noindex", "og-bild-saknas", "schema-saknas", "sitemap-saknas", "titel-saknas",
      "tunt-innehall", "viewport-saknas",
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
