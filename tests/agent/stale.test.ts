import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.chdir(mkdtempSync(path.join(tmpdir(), "mp-stale-")));

test("ett jobb som hängt sig räknas tillbaka till kvoten när någon frågar", async () => {
  const { createKey, findKey, consumeQuota } = await import("../../lib/agent/keys");
  const { createOrder, getOrder, saveOrder } = await import("../../lib/agent/orders");
  const { settleOrder } = await import("../../lib/agent/services");

  const { key, record } = await createKey("Hängbolaget", 2);
  assert.equal(await consumeQuota(record), true);
  const order = await createOrder(record.id, "health_check", {});
  const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  await saveOrder({ ...order, status: "running", createdAt: old, startedAt: old });

  const settled = await settleOrder((await getOrder(order.id))!);
  assert.equal(settled.status, "error");
  assert.match(settled.error!, /inte dragits från kvoten/);
  assert.equal((await findKey(key))!.used, 0);

  // En andra fråga räknar inte tillbaka en gång till
  await settleOrder((await getOrder(order.id))!);
  assert.equal((await findKey(key))!.used, 0);
});

test("ett hälsokoll följer sin analys: klar ger resultat, fel ger återbetalning", async () => {
  const { createKey, findKey, consumeQuota } = await import("../../lib/agent/keys");
  const { createOrder, getOrder, saveOrder } = await import("../../lib/agent/orders");
  const { settleOrder } = await import("../../lib/agent/services");
  const { saveAnalysis } = await import("../../lib/store");

  const { key, record } = await createKey("Analysbolaget", 5);
  const base = {
    createdAt: new Date().toISOString(), statusMessage: "", crawl: null, error: null,
    brief: { companyName: "X", websiteUrl: "x.se", industry: "", goal: "mål", followUps: [] },
  };
  const hc = { summary: "Bra läge", strengths: [], gaps: [], competitors: [], plan: [] };

  await consumeQuota(record);
  await saveAnalysis({ ...base, id: "anal-klar", status: "analyzing", healthCheck: null });
  const ok = await createOrder(record.id, "health_check", {});
  await saveOrder({ ...ok, status: "running", analysisId: "anal-klar", startedAt: new Date().toISOString() });
  assert.equal((await settleOrder((await getOrder(ok.id))!)).status, "running");
  await saveAnalysis({ ...base, id: "anal-klar", status: "done", healthCheck: hc });
  const done = await settleOrder((await getOrder(ok.id))!);
  assert.equal(done.status, "done");
  assert.deepEqual(done.result, hc);
  assert.equal((await findKey(key))!.used, 1);

  await consumeQuota((await findKey(key))!);
  await saveAnalysis({ ...base, id: "anal-fel", status: "error", healthCheck: null, error: "401 invalid x-api-key" });
  const bad = await createOrder(record.id, "health_check", {});
  await saveOrder({ ...bad, status: "running", analysisId: "anal-fel", startedAt: new Date().toISOString() });
  const failed = await settleOrder((await getOrder(bad.id))!);
  assert.equal(failed.status, "error");
  assert.doesNotMatch(failed.error!, /x-api-key/);
  assert.equal((await findKey(key))!.used, 1);
});
