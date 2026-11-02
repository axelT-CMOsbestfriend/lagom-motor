"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import type { AnalysisRecord } from "@/lib/types";

const FREE_LIMIT = 3;
const AUTO_OPEN_DELAY_MS = 900;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function openingMessage(record: AnalysisRecord): string {
  const name = record.brief.companyName;
  const firstGap = record.healthCheck?.gaps?.[0];
  if (firstGap) {
    return `Hej! Jag har precis gått igenom ${name}s Marknadshälsokoll. En sak som sticker ut är "${firstGap.title}" – vill du att vi bollar kring det, eller har du något annat du undrar över?`;
  }
  return `Hej! Jag har precis gått igenom ${name}s Marknadshälsokoll. Vad vill du bolla kring?`;
}

export default function Bollplanket({ record }: { record: AnalysisRecord }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(true);
      setMessages([{ role: "assistant", content: openingMessage(record) }]);
    }, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const questionsUsed = messages.filter((m) => m.role === "user").length;
  const limitReached = questionsUsed >= FREE_LIMIT;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || limitReached) return;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: input.trim() },
    ];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyses/${record.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message ?? data.error ?? "Något gick fel");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-medium text-[var(--color-on-primary)] shadow-lg transition hover:scale-105 hover:bg-[var(--color-accent-hover)]"
      >
        <MessageCircle className="h-4 w-4" /> Bolla med din AI-CMO
      </button>
    );
  }

  return (
    <div className="animate-rise fixed bottom-6 right-6 z-50 flex max-h-[70vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-[var(--color-primary)] px-4 py-3 text-[var(--color-on-primary)]">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium">Bollplanket</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Minimera"
          className="rounded-full p-1 text-[var(--color-on-primary)]/70 transition hover:bg-white/10 hover:text-[var(--color-on-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm ${
              m.role === "user"
                ? "ml-auto bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "border border-[var(--color-border)] bg-[var(--color-muted)]/50 text-[var(--color-secondary)]"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="max-w-[90%] rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/50 px-3.5 py-2.5 text-sm text-[var(--color-muted-foreground)]">
            Din marknadschef funderar…
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
          {limitReached
            ? "Gratisfrågorna är slut"
            : `${FREE_LIMIT - questionsUsed} av ${FREE_LIMIT} kostnadsfria frågor kvar`}
        </p>
        {limitReached ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Med <strong>Pro (399 kr/mån)</strong> får du obegränsat bollplank
            med din AI-marknadschef – plus hela handlingsplanen.
          </div>
        ) : (
          <form onSubmit={send} className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-muted)]"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Skriv din fråga…"
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Skicka"
              className="flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-[var(--color-on-primary)] transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-xs text-[var(--color-destructive)]">{error}</p>}
      </div>
    </div>
  );
}
