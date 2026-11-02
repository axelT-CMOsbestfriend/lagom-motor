"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Activity,
  Radar,
  Map as MapIcon,
  Search,
  Blocks,
  Users,
  ArrowRight,
} from "lucide-react";

function logEvent(name: string, analysisId: string | null = null) {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, analysisId }),
  }).catch(() => {});
}

export default function BriefPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [goal, setGoal] = useState("");
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const briefStartedLogged = useRef(false);

  function onFirstInput() {
    if (!briefStartedLogged.current) {
      briefStartedLogged.current = true;
      logEvent("brief_started");
    }
  }

  async function fetchQuestions(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brief-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, websiteUrl, industry, goal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Något gick fel");
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  async function startAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (!questions) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          websiteUrl,
          industry,
          goal,
          followUps: questions.map((q, i) => ({
            question: q,
            answer: answers[i] ?? "",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Något gick fel");
      router.push(`/analys/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm text-[var(--color-foreground)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-muted)]";
  const labelCls = "mb-1.5 block text-sm font-medium text-[var(--color-secondary)]";

  return (
    <div>
      <div className="animate-rise mb-10 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-medium text-[var(--color-secondary)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-highlight)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-highlight)]" />
          </span>
          För marknadschefer i Sverige &amp; Norden
        </div>
        <h1 className="mb-5 text-5xl leading-[1.05] tracking-tight text-[var(--color-primary)] sm:text-6xl">
          Din marknadsavdelning på två personer
          <br className="hidden sm:block" /> jobbar som en på tio
        </h1>
        <p className="mx-auto max-w-xl text-lg text-[var(--color-secondary)]">
          Beskriv ditt företag och ditt mål – få en marknadsbyrås analys på
          minuter, och bygg vidare därifrån.
        </p>
      </div>

      {questions === null ? (
        <form
          onSubmit={fetchQuestions}
          className="animate-rise mx-auto max-w-xl space-y-5 rounded-2xl border border-[var(--color-border)] bg-white p-8 shadow-sm"
          style={{ animationDelay: "80ms" }}
        >
          <div>
            <label className={labelCls}>Företagsnamn</label>
            <input
              className={inputCls}
              value={companyName}
              onFocus={onFirstInput}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="t.ex. Bergs Rör AB"
              required
            />
          </div>
          <div>
            <label className={labelCls}>Webbplats</label>
            <input
              className={inputCls}
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="t.ex. bergsror.se"
              required
            />
          </div>
          <div>
            <label className={labelCls}>Bransch</label>
            <input
              className={inputCls}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="t.ex. VVS och rörmokeri i Uppsala"
            />
          </div>
          <div>
            <label className={labelCls}>
              Vad vill du uppnå med din marknadsföring?
            </label>
            <textarea
              className={`${inputCls} min-h-24`}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder='I klartext – t.ex. "jag vill synas bättre på Google" eller "vi behöver fler bokningar via hemsidan"'
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] py-3 font-medium text-[var(--color-on-primary)] transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {loading ? (
              "Ett ögonblick…"
            ) : (
              <>
                Fortsätt <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
        </form>
      ) : (
        <form
          onSubmit={startAnalysis}
          className="animate-rise mx-auto max-w-xl space-y-5 rounded-2xl border border-[var(--color-border)] bg-white p-8 shadow-sm"
        >
          <div className="mb-2">
            <h2 className="text-xl text-[var(--color-primary)]">
              Några följdfrågor från din marknadschef
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Ju mer du berättar, desto träffsäkrare analys. Hoppa över det du
              inte vet.
            </p>
          </div>
          {questions.map((q, i) => (
            <div key={i}>
              <label className={labelCls}>{q}</label>
              <textarea
                className={`${inputCls} min-h-16`}
                value={answers[i] ?? ""}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--color-primary)] py-3 font-medium text-[var(--color-on-primary)] transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {loading ? "Startar analysen…" : "Starta mitt Marknadshälsokoll"}
          </button>
          {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
        </form>
      )}

      <div className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            Icon: Activity,
            title: "Marknadshälsokoll",
            desc: "Vad som saknas – gratis, på minuter",
          },
          {
            Icon: Radar,
            title: "Konkurrentradar",
            desc: "Hur konkurrenterna jobbar, och din lucka",
          },
          {
            Icon: MapIcon,
            title: "Action plan",
            desc: "Prioriterad 30/60/90-dagarsplan",
          },
        ].map(({ Icon, title, desc }, i) => (
          <div
            key={title}
            className="animate-rise rounded-xl border border-[var(--color-border)] bg-white p-5"
            style={{ animationDelay: `${160 + i * 60}ms` }}
          >
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[var(--color-primary)]">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="font-semibold text-[var(--color-primary)]">
              {title}
            </div>
            <div className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {desc}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
          Värdetrappan
        </p>
        <h2 className="mb-7 text-center text-2xl text-[var(--color-primary)]">
          Gör jobbet själv – eller ta hjälp när det behövs
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              Icon: Search,
              step: "1",
              title: "Upptäck",
              desc: "Marknadshälsokoll, konkurrentradar och action plan – gratis, på minuter.",
              status: "Byggd",
            },
            {
              Icon: Blocks,
              step: "2",
              title: "Bygg själv",
              desc: "Skapa egna AI-verktyg och agenter för just ditt ändamål – rapporten som startpunkt, inte slut.",
              status: "Kommer snart",
            },
            {
              Icon: Users,
              step: "3",
              title: "Ta hjälp",
              desc: "Workshops, rådgivning och strategiskt partnerskap när ni är redo att agera.",
              status: "Kommer snart",
            },
          ].map(({ Icon, step, title, desc, status }) => (
            <div
              key={step}
              className="relative rounded-xl border border-[var(--color-border)] bg-white p-5"
            >
              <span
                className={`absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  status === "Byggd"
                    ? "bg-[var(--color-highlight)] text-[var(--color-primary)]"
                    : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                }`}
              >
                {status}
              </span>
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[var(--color-primary)]">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="text-xs font-semibold text-[var(--color-secondary)]">
                Steg {step}
              </div>
              <div className="font-semibold text-[var(--color-primary)]">
                {title}
              </div>
              <div className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                {desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
