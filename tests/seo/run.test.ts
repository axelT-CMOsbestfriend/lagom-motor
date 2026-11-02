import { test } from "node:test";
import assert from "node:assert/strict";
import { runSeoAudit, type SeoDeps } from "../../lib/seo/run";
import { extractPage } from "../../lib/crawler";
import type { CrawlResult } from "../../lib/types";

const crawl: CrawlResult = {
  baseUrl: "https://exempel.se/",
  pages: [extractPage("https://exempel.se/", "<html><head><title>Exempel</title></head><body><h1>Hej</h1></body></html>")],
  socialLinks: [],
  foundSitemap: false,
  errors: [],
};

const deps: SeoDeps = {
  crawl: async () => crawl,
  pageSpeed: async () => {
    throw new Error("PageSpeed svarade inte");
  },
  aiVisibility: async () => ({
    score: 25,
    questions: [
      { question: "Bästa byrån i Uppsala?", mentioned: false, companiesMentioned: ["Konkurrent AB"] },
      { question: "Billig redovisning Uppsala?", mentioned: true, companiesMentioned: ["Exempel", "Konkurrent AB"] },
    ],
    competitors: [{ name: "Konkurrent AB", mentions: 2 }],
  }),
  keywords: async (_ctx, competitors) => {
    assert.deepEqual(competitors, ["Konkurrent AB"]);
    return {
      score: 50,
      keywords: [
        { keyword: "redovisningsbyrå uppsala", intent: "köp", targetPage: "/", pageExists: true, volume: "uppskattning: hög" },
        { keyword: "bokslut pris", intent: "köp", targetPage: "/bokslut", pageExists: false, volume: "uppskattning: medel" },
      ],
    };
  },
};

test("en del som fallerar stoppar inte resten av auditen", async () => {
  const audit = await runSeoAudit({ websiteUrl: "exempel.se" }, deps);
  assert.equal(audit.pageSpeed.ok, false);
  assert.equal(audit.onPage.ok, true);
  assert.equal(audit.aiVisibility.ok, true);
  assert.equal(audit.keywords.ok, true);
  assert.match(audit.summaryMarkdown, /Laddtid.*kunde inte mätas/i);
  assert.ok(audit.actions.length > 0 && audit.actions.length <= 10);
  assert.ok(audit.actions.some((a) => a.title.includes("/bokslut")));
  // Snittet räknas bara på de delar som gick att mäta
  assert.ok(audit.overallScore >= 0 && audit.overallScore <= 100);
});

test("åtgärderna sorteras efter effekt per arbetstimme", async () => {
  const audit = await runSeoAudit({ websiteUrl: "exempel.se" }, deps);
  const ratios = audit.actions.map((a) => a.impact / a.effortHours);
  assert.deepEqual(ratios, [...ratios].sort((a, b) => b - a));
});

test("misslyckad crawl ger ett fel", async () => {
  await assert.rejects(
    runSeoAudit({ websiteUrl: "exempel.se" }, { ...deps, crawl: async () => { throw new Error("Blockerad"); } }),
    /Blockerad/
  );
});
