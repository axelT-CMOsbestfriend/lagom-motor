import { test } from "node:test";
import assert from "node:assert/strict";
import { crawlSite, urlsFromSitemap } from "../../lib/crawler";

function mockFetch(routes: Record<string, { body: string; type?: string; redirect?: string }>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    const r = routes[url];
    if (!r) return new Response("saknas", { status: 404, headers: { "content-type": "text/html" } });
    const res = new Response(r.body, { status: 200, headers: { "content-type": r.type ?? "text/html" } });
    Object.defineProperty(res, "url", { value: r.redirect ?? url });
    return res;
  }) as typeof fetch;
  return () => (globalThis.fetch = original);
}

test("sitemap-index från robots.txt läses (WordPress/Yoast)", async () => {
  const restore = mockFetch({
    "https://exempel.se/robots.txt": { body: "User-agent: *\nSitemap: https://exempel.se/sitemap_index.xml", type: "text/plain" },
    "https://exempel.se/sitemap_index.xml": { body: "<sitemapindex><sitemap><loc>https://exempel.se/page-sitemap.xml</loc></sitemap></sitemapindex>", type: "application/xml" },
    "https://exempel.se/page-sitemap.xml": { body: "<urlset><url><loc>https://exempel.se/tjanster</loc></url></urlset>", type: "application/xml" },
  });
  try {
    assert.deepEqual(await urlsFromSitemap(new URL("https://exempel.se/")), ["https://exempel.se/tjanster"]);
  } finally {
    restore();
  }
});

test("crawlen utgår från adressen efter omdirigering", async () => {
  const restore = mockFetch({
    "https://gammal.se/": { body: "<html><body><a href='/om'>Om</a></body></html>", redirect: "https://www.ny.se/" },
    "https://www.ny.se/om": { body: "<html><title>Om</title><body>om oss</body></html>" },
  });
  try {
    const crawl = await crawlSite("gammal.se");
    assert.equal(crawl.baseUrl, "https://www.ny.se/");
    assert.ok(crawl.pages.some((p) => p.url === "https://www.ny.se/om"));
  } finally {
    restore();
  }
});
