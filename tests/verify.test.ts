import { test } from "node:test";
import assert from "node:assert/strict";
import { groundHealthCheck, isGroundedSource, parseHealthCheck, verifyCompetitors } from "../lib/verify";
import type { CrawlResult, HealthCheck } from "../lib/types";

const crawl: CrawlResult = {
  baseUrl: "https://kund.se",
  pages: [
    { url: "https://kund.se/", title: "Kund", metaDescription: null, h1: [], h2: [], textExcerpt: "", wordCount: 100, hasViewportMeta: true },
    { url: "https://kund.se/tjanster", title: "Tjänster", metaDescription: null, h1: [], h2: [], textExcerpt: "", wordCount: 100, hasViewportMeta: true },
  ],
  socialLinks: [],
  foundSitemap: true,
  errors: [],
};
const research = { competitors: [{ name: "Rörbolaget", url: "https://rorbolaget.se", notes: "" }] };

test("källor som pekar på crawlad sida, brief eller konkurrent godkänns", () => {
  assert.ok(isGroundedSource("https://kund.se/tjanster: saknar meta", crawl, research));
  assert.ok(isGroundedSource("/tjanster saknar priser", crawl, research));
  assert.ok(isGroundedSource("Startsidan saknar kundcase", crawl, research));
  assert.ok(isGroundedSource("brief: målet är fler leads", crawl, research));
  assert.ok(isGroundedSource("Rörbolaget har prislista", crawl, research));
});

test("påhittad källa underkänns", () => {
  assert.equal(isGroundedSource("branschstudier visar att 70 % googlar", crawl, research), false);
  assert.equal(isGroundedSource("https://annan.se/om", crawl, research), false);
});

test("påhittade konkurrenter tas bort och okällade punkter listas", () => {
  const hc: HealthCheck = {
    summary: "s",
    strengths: [{ title: "Bra", detail: "d", source: "startsidan: tydlig rubrik" }],
    gaps: [{ title: "Gissning", detail: "d", why: "w", source: "experter menar" }],
    competitors: [
      { name: "Rörbolaget", url: "https://www.rorbolaget.se", overview: "", theirEdge: "", yourOpening: "" },
      { name: "Fantasi AB", url: "https://fantasi.se", overview: "", theirEdge: "", yourOpening: "" },
    ],
    plan: [],
  };
  const { healthCheck, report } = groundHealthCheck(hc, crawl, research);
  assert.deepEqual(healthCheck.competitors.map((c) => c.name), ["Rörbolaget"]);
  assert.deepEqual(report.inventedCompetitors, ["Fantasi AB"]);
  assert.deepEqual(report.ungrounded, ["Gissning"]);
});

test("schemat underkänner svar utan plan", () => {
  assert.throws(() => parseHealthCheck({ summary: "s", strengths: [], gaps: [], competitors: [] }));
});

test("konkurrenter som inte svarar, är kunden eller dubbletter tas bort", async () => {
  const fake = async (url: string) => new Response(null, { status: url.includes("dod") ? 404 : 200 });
  const { research: kept, dropped } = await verifyCompetitors(
    {
      competitors: [
        { name: "Levande", url: "https://levande.se", notes: "" },
        { name: "Död", url: "https://dod.se", notes: "" },
        { name: "Kunden", url: "https://www.kund.se", notes: "" },
        { name: "Levande igen", url: "levande.se/om", notes: "" },
      ],
    },
    "https://kund.se",
    fake
  );
  assert.deepEqual(kept.competitors.map((c) => c.name), ["Levande"]);
  assert.equal(dropped.length, 3);
});
