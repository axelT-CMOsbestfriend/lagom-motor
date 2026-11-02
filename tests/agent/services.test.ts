import { test } from "node:test";
import assert from "node:assert/strict";
import { orderView, validateInput } from "../../lib/agent/services";
import type { Order } from "../../lib/agent/orders";

const base: Order = {
  id: "ord_1", apiKeyId: "k", service: "seo_audit", status: "running", input: {},
  result: null, analysisId: null, error: null,
  createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), finishedAt: null,
};

test("en pågående order visar bara status", () => {
  const view = orderView(base, "https://x.se") as Record<string, unknown>;
  assert.equal(view.status, "running");
  assert.equal(view.result, undefined);
  assert.match(String(view.message), /Fråga igen/);
});

test("en klar SEO-order ger resultat och sammanfattning", () => {
  const done: Order = { ...base, status: "done", result: { summaryMarkdown: "# SEO-audit", overallScore: 70 } };
  const view = orderView(done, "https://x.se") as Record<string, unknown>;
  assert.equal(view.summary, "# SEO-audit");
  assert.deepEqual(view.result, { summaryMarkdown: "# SEO-audit", overallScore: 70 });
});

test("en order som hängt sig visas som fel", () => {
  const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  const view = orderView({ ...base, createdAt: old, startedAt: old }, "https://x.se") as Record<string, unknown>;
  assert.equal(view.status, "error");
  assert.equal(view.error, "Jobbet tog för lång tid");
});

test("indata kontrolleras innan ordern skapas", () => {
  assert.equal(validateInput("seo_audit", { websiteUrl: "exempel.se" }), null);
  assert.match(String(validateInput("seo_audit", { websiteUrl: "" })), /websiteUrl/);
  assert.match(String(validateInput("health_check", { websiteUrl: "exempel.se" })), /companyName/);
  const media = { companyName: "X", goal: "Fler kunder", budgetSek: 5000, weeks: 4, ageMin: 25, ageMax: 54, genders: ["kvinna"], businessModel: "b2c" };
  assert.match(String(validateInput("media_plan", media)), /Budgeten/);
  assert.equal(validateInput("media_plan", { ...media, budgetSek: 100000 }), null);
});
