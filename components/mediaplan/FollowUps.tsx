"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { QuestionAnswer } from "@/lib/media/answers";
import { primaryButton } from "./shared";

// Följdfrågor med svar ur simuleringen, plus en egen fråga som går till
// samma chatt som Bollplanket (som nu också känner till mediaplanen)
export default function FollowUps({
  analysisId,
  questions,
}: {
  analysisId: string;
  questions: QuestionAnswer[];
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<{ q: string; a: string | null; error?: string }[]>([]);
  const [sending, setSending] = useState(false);

  function toggle(i: number) {
    const next = new Set(open);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setOpen(next);
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || sending) return;
    setSending(true);
    setQuestion("");
    setAsked((xs) => [...xs, { q, a: null }]);
    const history = asked.flatMap((x) =>
      x.a ? [{ role: "user", content: x.q }, { role: "assistant", content: x.a }] : []
    );
    try {
      const res = await fetch(`/api/analyses/${analysisId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content: q }] }),
      });
      const data = await res.json().catch(() => ({}));
      const answer = res.ok ? data.reply : null;
      const error = res.ok ? undefined : (data.message ?? data.error ?? "Något gick fel");
      setAsked((xs) => xs.map((x, i) => (i === xs.length - 1 ? { q, a: answer, error } : x)));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="max-w-2xl">
      <h2 className="text-3xl text-[var(--color-primary)]">Fråga vidare</h2>
      <p className="mb-3 mt-1 text-sm text-[var(--color-muted-foreground)]">
        Svaren bygger på samma simulering som planen.
      </p>
      <ul>
        {questions.map((qa, i) => (
          <li key={qa.question} className="border-b border-[var(--color-border)]">
            <button
              type="button"
              aria-expanded={open.has(i)}
              onClick={() => toggle(i)}
              className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-[17px] font-semibold text-[var(--color-primary)]"
            >
              {qa.question}
              <Plus
                className={`h-5 w-5 flex-none transition-transform ${open.has(i) ? "rotate-45" : ""}`}
                strokeWidth={1.75}
              />
            </button>
            {open.has(i) && (
              <p className="max-w-prose pb-4 text-[15px] text-[var(--color-secondary)]">{qa.answer}</p>
            )}
          </li>
        ))}
      </ul>

      {asked.map((x, i) => (
        <div key={i} className="mt-4">
          <p className="font-semibold text-[var(--color-primary)]">{x.q}</p>
          <p className="mt-1 whitespace-pre-line text-[15px] text-[var(--color-secondary)]">
            {x.error ?? x.a ?? "Din marknadschef tänker…"}
          </p>
        </div>
      ))}

      <form
        onSubmit={ask}
        className="mt-5 flex gap-2 rounded-full border border-[var(--color-border)] bg-white py-1.5 pl-5 pr-1.5"
      >
        <label htmlFor="mp-ask" className="sr-only">
          Egen fråga om planen
        </label>
        <input
          id="mp-ask"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ställ en egen fråga om planen…"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--color-muted-foreground)]"
        />
        <button type="submit" disabled={sending || !question.trim()} className={`${primaryButton} rounded-full py-2`}>
          Fråga
        </button>
      </form>
    </section>
  );
}
