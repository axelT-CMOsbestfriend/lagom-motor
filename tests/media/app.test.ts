import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMediaPlanInput, requestFromInput } from "../../lib/media/input";
import { MAX_EXTRA_SECONDS, median, mediaPlanTimings } from "../../lib/media/metrics";
import { budgetGrid } from "../../lib/media/curve";
import { generatePlans } from "../../lib/media/planner";
import { toView } from "../../lib/media/view";
import type { LoggedEvent } from "../../lib/types";
import { FIXTURE_REQUEST } from "../fixtures/mediaplan/request";

const valid = {
  budgetSek: "200 000",
  weeks: 8,
  ageMin: 25,
  ageMax: 44,
  genders: ["kvinna", "man", "man"],
  businessModel: "b2c",
};

test("formuläret: giltig inmatning tolkas och städas", () => {
  const r = parseMediaPlanInput(valid);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.input.budgetSek, 200_000);
  assert.deepEqual(r.input.genders, ["kvinna", "man"]);
  assert.deepEqual(requestFromInput(r.input), FIXTURE_REQUEST);
});

test("formuläret: ogiltig inmatning ger begripligt fel", () => {
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ ...valid, budgetSek: 500 }, /Budgeten/],
    [{ ...valid, budgetSek: "abc" }, /Budgeten/],
    [{ ...valid, weeks: 0 }, /Perioden/],
    [{ ...valid, ageMin: 10 }, /Åldern/],
    [{ ...valid, ageMin: 50, ageMax: 30 }, /Åldern/],
    [{ ...valid, genders: ["annat"] }, /kön/],
    [{ ...valid, businessModel: "b2g" }, /konsumenter eller företag/],
  ];
  for (const [body, message] of cases) {
    const r = parseMediaPlanInput(body);
    assert.ok(!r.ok, JSON.stringify(body));
    if (!r.ok) assert.match(r.error, message);
  }
  assert.ok(!parseMediaPlanInput(null).ok);
});

test("vyn med kurva är rimligt liten, serialiserbar och har samma siffror som simuleringen", () => {
  const result = generatePlans(FIXTURE_REQUEST);
  const curve = budgetGrid(FIXTURE_REQUEST.budgetSek).map((budgetSek) =>
    budgetSek === FIXTURE_REQUEST.budgetSek ? result : generatePlans({ ...FIXTURE_REQUEST, budgetSek })
  );
  const view = toView(result, curve);
  const json = JSON.stringify(view);
  assert.ok(json.length < 150_000, `vyn är ${json.length} tecken`);
  assert.deepEqual(JSON.parse(json), view);
  for (const [i, p] of view.plans.entries()) {
    const sim = result.plans[i].simulation;
    assert.equal(p.reach.mid, sim.mid.reachShare);
    assert.equal(p.channels.length, sim.mid.channels.length);
    assert.equal(p.totalBudgetSek, FIXTURE_REQUEST.budgetSek);
  }
  assert.ok(view.unverifiedAssumptions.some((a) => a.startsWith("CPM")));
  assert.ok(view.competitorChannelsAssumed);
});

function ev(name: LoggedEvent["name"], analysisId: string, at: string): LoggedEvent {
  return { name, analysisId, timestamp: `2026-09-25T10:${at}.000Z` };
}

test("mätning: tid från formulär till visad plan per analys", () => {
  const events: LoggedEvent[] = [
    ev("healthcheck_viewed", "a1", "00:00"),
    ev("mediaplan_form_opened", "a1", "01:00"),
    ev("mediaplan_started", "a1", "01:40"),
    ev("mediaplan_viewed", "a1", "02:30"),
    ev("mediaplan_viewed", "a1", "09:00"), // omladdning senare räknas inte
    ev("mediaplan_form_opened", "a2", "05:00"),
    ev("mediaplan_started", "a2", "05:20"),
  ];
  const timings = mediaPlanTimings(events);
  assert.deepEqual(timings, [
    { analysisId: "a1", formSeconds: 40, waitSeconds: 50, totalSeconds: 90 },
    { analysisId: "a2", formSeconds: 20, waitSeconds: null, totalSeconds: null },
  ]);
  assert.ok(timings[0].totalSeconds! <= MAX_EXTRA_SECONDS);
});

test("median", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});
