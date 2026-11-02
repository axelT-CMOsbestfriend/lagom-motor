import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.chdir(mkdtempSync(path.join(tmpdir(), "mp-keys-")));

test("en skapad nyckel hittas bara med rätt rå nyckel", async () => {
  const { createKey, findKey } = await import("../../lib/agent/keys");
  const { key, record } = await createKey("Testbolaget", 5);
  assert.match(key, /^lagom_[0-9a-f]{32}$/);
  assert.notEqual(record.id, key);
  assert.equal((await findKey(key))?.name, "Testbolaget");
  assert.equal(await findKey("lagom_" + "0".repeat(32)), null);
  assert.equal(await findKey(""), null);
});

test("kvoten tar slut och kan räknas tillbaka", async () => {
  const { createKey, findKey, consumeQuota, refundQuota } = await import("../../lib/agent/keys");
  const { key, record } = await createKey("Kvotbolaget", 1);
  assert.equal(await consumeQuota(record), true);
  assert.equal(await consumeQuota((await findKey(key))!), false);
  await refundQuota(record.id);
  assert.equal((await findKey(key))!.used, 0);
});
