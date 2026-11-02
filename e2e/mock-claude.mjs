// Låtsas-API för Claude i e2e-testet. Svarar med fasta svar beroende på
// systemprompten, så att hela flödet kan köras utan API-nyckel.
import http from "node:http";
import { readFileSync } from "node:fs";

function fixture(name) {
  const url = new URL(`../tests/fixtures/mediaplan/${name}`, import.meta.url);
  const json = JSON.parse(readFileSync(url, "utf8"));
  delete json._ursprung;
  return json;
}

const healthCheck = {
  summary: "Exempelbolaget har en tydlig vardagsposition men syns lite utanför sin egen sajt.",
  strengths: [
    { title: "Tydligt erbjudande", detail: "Surdegsbröd och kaffe står överst.", source: "startsidans rubrik" },
  ],
  gaps: [
    {
      title: "Inga kundomdömen",
      detail: "Sajten saknar omdömen.",
      why: "Nya kunder litar på andra kunder.",
      source: "inga omdömen på startsidan",
    },
  ],
  competitors: ["A", "B", "C"].map((x) => ({
    name: `Bageri ${x}`,
    url: `https://example.com/${x}`,
    overview: "Aktiva i sociala medier.",
    theirEdge: "Fler följare.",
    yourOpening: "Morgonkunderna.",
  })),
  plan: ["30", "60", "90"].map((period) => ({
    period,
    items: [{ heading: `Steg för ${period} dagar`, detail: "Gör detta.", why: "Därför." }],
  })),
};

// Svaret som text: JSON för strukturerade anrop, vanlig text för chatten
function answerFor(system) {
  const json = (x) => JSON.stringify(x);
  if (system.includes("AI-CMO")) {
    return system.includes("MEDIAPLANEN")
      ? "Kör planen i åtta veckor och titta på räckvidden i annonshanterarna efter två veckor."
      : "Börja med kundomdömena, de saknas i dag.";
  }
  if (system.includes("följdfrågor")) {
    return json({ questions: ["Vilka är era viktigaste kunder?", "Vad skiljer er från andra kaféer?"] });
  }
  if (system.includes("Marknadshälsokoll")) return json(healthCheck);
  if (system.includes("mediestrateg")) return json(fixture("forklaring.json"));
  if (system.includes("syntetisk panel")) return json(fixture("panelsvar.json"));
  return null;
}

function message(text) {
  return {
    id: "msg_e2e",
    type: "message",
    role: "assistant",
    model: "e2e-mock",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

function streamMessage(res, text) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send("message_start", { type: "message_start", message: { ...message(""), content: [], stop_reason: null } });
  send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
  send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } });
  send("content_block_stop", { type: "content_block_stop", index: 0 });
  send("message_delta", {
    type: "message_delta",
    delta: { stop_reason: "end_turn", stop_sequence: null },
    usage: { output_tokens: 1 },
  });
  send("message_stop", { type: "message_stop" });
  res.end();
}

export function startMockClaude(port, { delayMs = 1000 } = {}) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      const request = JSON.parse(body || "{}");
      const system = typeof request.system === "string" ? request.system : JSON.stringify(request.system ?? "");
      const answer = answerFor(system);
      if (!answer) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "okänd prompt" } }));
        return;
      }
      await new Promise((r) => setTimeout(r, delayMs));
      const text = answer;
      if (request.stream) streamMessage(res, text);
      else {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(message(text)));
      }
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
