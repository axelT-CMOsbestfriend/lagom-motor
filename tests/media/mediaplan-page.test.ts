import { test } from "node:test";
import assert from "node:assert/strict";
import { computedReasons, followUps, howToBuy } from "../../lib/media/answers";
import { budgetGrid } from "../../lib/media/curve";
import { guessTarget, DEFAULT_TARGET } from "../../lib/media/guess";
import { MAX_BUDGET, MIN_BUDGET, requestFromInput, type MediaPlanInput } from "../../lib/media/input";
import { generatePlans } from "../../lib/media/planner";
import { DOT_COUNT, toView } from "../../lib/media/view";
import { cmoSystemPrompt } from "../../lib/claude";
import type { AnalysisRecord } from "../../lib/types";
import { FIXTURE_REQUEST } from "../fixtures/mediaplan/request";

const input: MediaPlanInput = {
  budgetSek: 200_000,
  weeks: 8,
  ageMin: 25,
  ageMax: 44,
  genders: ["kvinna", "man"],
  businessModel: "b2c",
};
const request = requestFromInput(input);
const result = generatePlans(request);
const curveResults = budgetGrid(request.budgetSek).map((b) =>
  b === request.budgetSek ? result : generatePlans({ ...request, budgetSek: b })
);
const view = toView(result, curveResults);

// ---------- Budgetkurvan ----------

test("budgetnivåerna innehåller vald budget, är sorterade och håller sig inom gränserna", () => {
  for (const budget of [10_000, 35_000, 200_000, 1_000_000, MAX_BUDGET]) {
    const grid = budgetGrid(budget);
    assert.ok(grid.includes(budget), String(budget));
    assert.deepEqual(grid, [...grid].sort((a, b) => a - b));
    assert.ok(grid.every((b) => b >= MIN_BUDGET && b <= MAX_BUDGET));
    assert.ok(grid.length >= 3 && grid.length <= 10, `${budget}: ${grid.length} nivåer`);
  }
});

test("kurvan har vald budget med samma planer som vyn, och räckvidden ökar med budgeten", () => {
  const committed = view.curve.find((p) => p.budgetSek === input.budgetSek);
  assert.ok(committed);
  assert.deepEqual(committed.plans, view.plans);
  for (let i = 1; i < view.curve.length; i++) {
    const prev = view.curve[i - 1].plans.find((p) => p.id === "rackvidd")!;
    const next = view.curve[i].plans.find((p) => p.id === "rackvidd")!;
    assert.ok(next.reach.mid >= prev.reach.mid - 0.01, `${view.curve[i].budgetSek} kr`);
  }
});

// ---------- Prickarna ----------

test("100 personer, och antalet ifyllda prickar är samma som räckvidden av 100", () => {
  assert.equal(view.people.length, DOT_COUNT);
  for (const point of view.curve) {
    for (const p of point.plans) {
      assert.equal(p.reached.length, DOT_COUNT);
      const filled = p.reached.reduce((s, x) => s + x, 0);
      assert.equal(filled, Math.round(p.reach.mid * 100), `${point.budgetSek}/${p.id}`);
    }
  }
});

test("en ifylld prick är alltid en person som använder någon av planens kanaler", () => {
  for (const p of view.plans) {
    const planChannels = new Set(p.channels.map((c) => c.channel));
    p.reached.forEach((on, i) => {
      if (on) assert.ok(view.people[i].channels.some((c) => planChannels.has(c)), view.people[i].id);
    });
  }
});

test("samma personer visas för alla budgetnivåer", () => {
  const again = toView(curveResults[0], curveResults);
  assert.deepEqual(again.people, view.people);
});

// ---------- Följdfrågor och texter ----------

test("följdfrågorna bygger på siffror som finns i vyn", () => {
  const plan = view.plans.find((p) => p.id === "rackvidd")!;
  const qa = followUps(view, plan, input);
  assert.ok(qa.length >= 2);
  const only = plan.topChannelOnly!;
  assert.ok(only, "planen har flera kanaler, så frågan om bara den största ska finnas");
  assert.ok(only.reachShare <= plan.reach.mid + 1e-9, "planen optimerar räckvidd och ska nå minst lika många");
  assert.match(qa[0].question, new RegExp(only.label));
  assert.match(qa[0].answer, new RegExp(`${Math.round(only.reachShare * 100)} av 100`));
  const tiktok = qa.find((q) => q.question.includes("Tiktok"));
  assert.ok(tiktok, "Tiktok är utesluten för 25–44 år");
  assert.match(tiktok.answer, /13 av 100/);
  assert.match(qa.at(-1)!.answer, /25–44 år/);
});

test("köpanvisningen grupperar kanaler efter verktyg", () => {
  const plan = view.plans.find((p) => p.id === "rackvidd")!;
  const text = howToBuy(plan);
  assert.match(text, /Facebook och Instagram i Metas annonshanterare/);
  assert.match(text, /Youtube i Google Ads/);
});

test("uträknade motiveringar har en rad per kanal, största budget först", () => {
  const plan = view.plans.find((p) => p.id === "rackvidd")!;
  const reasons = computedReasons(view, plan);
  assert.equal(reasons.length, plan.channels.length);
  assert.equal(reasons[0].channel, [...plan.channels].sort((a, b) => b.budgetSek - a.budgetSek)[0].channel);
  assert.match(reasons[0].text, /av 100 i din målgrupp använder/);
});

// ---------- Gissad målgrupp ----------

const brief = (goal: string, answers: string[] = []) => ({
  goal,
  industry: "Kafé",
  followUps: answers.map((answer) => ({ question: "?", answer })),
});

test("målgruppen gissas ur briefen när den nämns", () => {
  assert.deepEqual(guessTarget(brief("Fler kunder", ["Mest folk som jobbar i centrum, 25–45 år"])), {
    ageMin: 25,
    ageMax: 45,
    genders: ["kvinna", "man"],
    fromBrief: true,
  });
  const women = guessTarget(brief("Vi säljer träningskläder till kvinnor 30-50 år"));
  assert.deepEqual([women.ageMin, women.ageMax, women.genders], [30, 50, ["kvinna"]]);
  assert.equal(guessTarget(brief("Nå pensionärer 60 till 90 år")).ageMax, 84);
});

test("utan ledtrådar i briefen används standardmålgruppen och det sägs öppet", () => {
  assert.deepEqual(guessTarget(brief("Fler bokningar via hemsidan")), DEFAULT_TARGET);
  assert.equal(DEFAULT_TARGET.fromBrief, false);
});

// ---------- Chatten känner till mediaplanen ----------

test("chatten får mediaplanen som underlag när den finns", () => {
  const base = {
    id: "abc12345",
    createdAt: "2026-09-25T10:00:00.000Z",
    status: "done",
    statusMessage: "Klart!",
    brief: { companyName: "Exempel", websiteUrl: "example.com", industry: "Kafé", goal: "Fler kunder", followUps: [] },
    crawl: null,
    healthCheck: null,
    error: null,
  } satisfies AnalysisRecord;
  assert.doesNotMatch(cmoSystemPrompt(base), /MEDIAPLANEN/);
  const withPlan: AnalysisRecord = {
    ...base,
    mediaPlan: {
      status: "done",
      input,
      startedAt: "2026-09-25T10:00:00.000Z",
      finishedAt: null,
      view,
      explanation: null,
      panel: null,
      panelError: null,
      error: null,
    },
  };
  const prompt = cmoSystemPrompt(withPlan);
  assert.match(prompt, /MEDIAPLANEN: \{/);
  assert.match(prompt, /hitta inte på nya/);
  // Kurvan och prickarna skickas inte till chatten
  assert.doesNotMatch(prompt, /"reached"/);
  assert.ok(prompt.length < 20_000, `${prompt.length} tecken`);
  assert.deepEqual(requestFromInput(input), FIXTURE_REQUEST);
});
