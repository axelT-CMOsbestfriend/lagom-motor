import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.chdir(mkdtempSync(path.join(tmpdir(), "mp-orders-")));

test("en order sparas och läses tillbaka", async () => {
  const { createOrder, getOrder } = await import("../../lib/agent/orders");
  const order = await createOrder("nyckel1", "seo_audit", { websiteUrl: "exempel.se" });
  assert.equal(order.status, "queued");
  assert.deepEqual((await getOrder(order.id))?.input, { websiteUrl: "exempel.se" });
});

test("markStale stoppar jobb som hängt sig i över 10 minuter", async () => {
  const { markStale } = await import("../../lib/agent/orders");
  const now = new Date("2026-10-20T12:00:00Z");
  const base = {
    id: "o1", apiKeyId: "k", service: "seo_audit" as const, input: {}, result: null,
    analysisId: null, error: null, startedAt: null, finishedAt: null,
  };
  const old = markStale({ ...base, status: "running", createdAt: "2026-10-20T11:49:00Z" }, now);
  assert.equal(old.status, "error");
  assert.equal(old.error, "Jobbet tog för lång tid");
  const fresh = markStale({ ...base, status: "running", createdAt: "2026-10-20T11:55:00Z" }, now);
  assert.equal(fresh.status, "running");
  const done = markStale({ ...base, status: "done", createdAt: "2026-10-20T10:00:00Z" }, now);
  assert.equal(done.status, "done");
});
