import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { friendlyError } from "../lib/errors";

test("Anthropics råa fel blir korta svenska texter", () => {
  const auth = new Anthropic.AuthenticationError(401, { type: "error" }, "invalid x-api-key", new Headers());
  assert.equal(friendlyError(auth), "Tjänsten är tillfälligt otillgänglig hos oss.");
  const busy = new Anthropic.RateLimitError(429, { type: "error" }, "rate limited", new Headers());
  assert.equal(friendlyError(busy), "AI-tjänsten är överbelastad just nu.");
  assert.doesNotMatch(friendlyError(auth), /x-api-key/);
});

test("PageSpeeds kvotfel förklaras utan projektnummer", () => {
  const msg = friendlyError(new Error("PageSpeed svarade 429: Quota exceeded for consumer 'project_number:583797351490'."));
  assert.equal(msg, "Googles PageSpeed har nått sin dagskvot.");
});

test("våra egna svenska meddelanden går igenom oförändrade", () => {
  const msg = "Kunde inte hämta startsidan (https://exempel.se/): timeout";
  assert.equal(friendlyError(new Error(msg)), msg);
  assert.equal(friendlyError(new Error("ECONNRESET socket hang up")), "Något gick fel i analysen.");
});
