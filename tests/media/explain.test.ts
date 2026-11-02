import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type Anthropic from "@anthropic-ai/sdk";
import {
  EXPLANATION_SCHEMA,
  askPanel,
  explainPlans,
  PANEL_SCHEMA,
  buildExplainPrompt,
  buildPanelPrompt,
  selectPersonas,
  validateExplanation,
  validatePanelAnswers,
  type Explanation,
  type PanelAnswer,
} from "../../lib/media/explain";
import { generatePlans } from "../../lib/media/planner";
import { RULE_IDS } from "../../lib/media/rules";
import { FIXTURE_BRIEF, FIXTURE_REQUEST } from "../fixtures/mediaplan/request";

const result = generatePlans(FIXTURE_REQUEST);

function load<T>(name: string): T {
  const raw = JSON.parse(readFileSync(`tests/fixtures/mediaplan/${name}`, "utf8"));
  delete raw._ursprung;
  return raw as T;
}

const explanation = load<Explanation>("forklaring.json");
const clone = () => structuredClone(explanation);

test("sparat svar godkänns", () => {
  assert.deepEqual(validateExplanation(explanation, result), []);
});

test("okänt regel-ID underkänns", () => {
  const e = clone();
  e.channelReasons[0].ruleIds = ["BF-99"];
  assert.ok(validateExplanation(e, result).some((m) => m.includes("okänd regel BF-99")));
});

test("okänt fakta-ID underkänns", () => {
  const e = clone();
  e.rejectedPlans[0].factIds.push("F-PAHITT");
  assert.ok(validateExplanation(e, result).some((m) => m.includes("F-PAHITT")));
});

test("motivering utan regel eller fakta underkänns", () => {
  const e = clone();
  e.channelReasons[1].ruleIds = [];
  e.channelReasons[1].factIds = [];
  const errors = validateExplanation(e, result);
  assert.ok(errors.some((m) => m.includes("saknar regel-ID")));
  assert.ok(errors.some((m) => m.includes("saknar fakta-ID")));
});

test("påhittad procentsats underkänns, också i sammanfattningen", () => {
  const e = clone();
  e.channelReasons[0].reason = "Facebook når hela 83 % av målgruppen.";
  e.summary = "Planen når 99 % av alla.";
  const errors = validateExplanation(e, result);
  assert.ok(errors.some((m) => m.includes("andelen 83 ")));
  assert.ok(errors.some((m) => m.includes("andelen 99 ")));
});

test("påhittad andel skriven som 'X av 100' underkänns också", () => {
  const e = clone();
  e.channelReasons[0].reason = "Facebook når 64 av 100 i målgruppen.";
  assert.ok(validateExplanation(e, result).some((m) => m.includes("andelen 64 ")));
});

test("procentsats från ett fakta som inte citeras underkänns", () => {
  const e = clone();
  // 37 av 100 finns i F-luckan-RACKVIDD men motiveringen citerar bara Instagram-faktat
  e.channelReasons[1].reason = "Instagram är bättre än Där konkurrenterna inte är, som når 37 av 100.";
  assert.ok(validateExplanation(e, result).some((m) => m.includes("andelen 37 ")));
});

test("kanal i rekommenderad plan utan motivering underkänns", () => {
  const e = clone();
  e.channelReasons = e.channelReasons.filter((r) => r.channel !== "youtube");
  assert.ok(validateExplanation(e, result).some((m) => m.includes("youtube")));
});

test("motivering för kanal utan budget underkänns", () => {
  const e = clone();
  e.channelReasons[0].channel = "tv4";
  assert.ok(validateExplanation(e, result).some((m) => m.includes("ingen budget")));
});

test("plan som inte valts måste motiveras", () => {
  const e = clone();
  e.rejectedPlans = e.rejectedPlans.filter((r) => r.planId !== "luckan");
  assert.ok(validateExplanation(e, result).some((m) => m.includes("luckan")));
});

test("prompten innehåller alla regler, fakta och planer", () => {
  const { system, user } = buildExplainPrompt(result, FIXTURE_BRIEF);
  assert.match(system, /hitta aldrig på egna siffror/i);
  for (const id of RULE_IDS) assert.ok(user.includes(id), id);
  for (const f of result.facts) assert.ok(user.includes(f.id), f.id);
  assert.ok(user.includes(FIXTURE_BRIEF.companyName));
});

test("schemana kräver additionalProperties: false på alla objekt", () => {
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object") assert.equal(n.additionalProperties, false, path);
    for (const [k, v] of Object.entries(n)) walk(v, `${path}.${k}`);
  };
  walk(EXPLANATION_SCHEMA, "explanation");
  walk(PANEL_SCHEMA, "panel");
});

// ---------- Panelen ----------

const planChannels = result.plans
  .find((p) => p.id === "rackvidd")!
  .simulation.plan.allocations.map((a) => a.channel);
const personas = selectPersonas(result.panel, planChannels);
const { answers } = load<{ answers: PanelAnswer[] }>("panelsvar.json");

test("urvalet: sex personer, båda könen, sist en som planen inte når", () => {
  assert.equal(personas.length, 6);
  assert.deepEqual(new Set(personas.map((p) => p.gender)), new Set(["kvinna", "man"]));
  const last = personas.at(-1)!;
  assert.ok(!last.channels.some((c) => planChannels.includes(c)));
  for (const p of personas.slice(0, -1)) {
    assert.ok(p.channels.some((c) => planChannels.includes(c)), p.id);
  }
});

test("sparade panelsvar godkänns", () => {
  assert.deepEqual(validatePanelAnswers(answers, personas, planChannels), []);
});

test("panelsvar underkänns vid fel kanal, siffror, saknade eller extra personer", () => {
  const bad = structuredClone(answers);
  bad[0].noticedIn = ["tiktok"];
  bad[1].quote = "Jag ser den typ 3 gånger om dagen.";
  bad.pop();
  bad.push({ personaId: "p9999", noticedIn: [], moment: "aldrig", quote: "Vem är jag?" });
  const errors = validatePanelAnswers(bad, personas, planChannels);
  assert.ok(errors.some((m) => m.includes("använder inte tiktok")));
  assert.ok(errors.some((m) => m.includes("siffror")));
  assert.ok(errors.some((m) => m.includes("saknar svar")));
  assert.ok(errors.some((m) => m.includes("p9999")));
});

test("panelprompten beskriver varje persons faktiska kanaler", () => {
  const { user } = buildPanelPrompt(personas, planChannels, FIXTURE_BRIEF);
  for (const p of personas) {
    assert.ok(user.includes(`${p.id}: ${p.gender}, ${p.age} år.`), p.id);
  }
});

// ---------- Anropet, med en falsk klient ----------

function fakeClient(replies: unknown[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        calls.push(params);
        const next = replies[Math.min(calls.length - 1, replies.length - 1)];
        return {
          stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify(next) }],
        };
      },
    },
  };
  return { client: client as unknown as Anthropic, calls };
}

test("underkänt svar skickas tillbaka med felen och det rättade svaret används", async () => {
  const bad = clone();
  bad.channelReasons[0].ruleIds = ["BF-99"];
  const { client, calls } = fakeClient([bad, explanation]);
  const out = await explainPlans(result, FIXTURE_BRIEF, client);
  assert.deepEqual(out, explanation);
  assert.equal(calls.length, 2);
  const retry = calls[1].messages as { role: string; content: string }[];
  assert.equal(retry.at(-1)?.role, "user");
  assert.match(retry.at(-1)!.content, /okänd regel BF-99/);
  const format = (calls[0].output_config as { format: { type: string } }).format;
  assert.equal(format.type, "json_schema");
});

test("underkänt två gånger ger fel i stället för en motivering som inte håller", async () => {
  const bad = clone();
  bad.summary = "Planen når 99 % av alla.";
  const { client } = fakeClient([bad, bad]);
  await assert.rejects(explainPlans(result, FIXTURE_BRIEF, client), /underkändes två gånger/);
});

test("askPanel använder samma urval som valideringen", async () => {
  const { client } = fakeClient([{ answers }]);
  const out = await askPanel(result.panel, planChannels, FIXTURE_BRIEF, client);
  assert.deepEqual(out.personas.map((p) => p.id), personas.map((p) => p.id));
  assert.deepEqual(out.answers, answers);
});
