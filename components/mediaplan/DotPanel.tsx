"use client";

import { CHANNELS } from "@/lib/media/channels";
import type { ChannelId } from "@/lib/media/data/mediebarometern-2024";
import { listSv } from "@/lib/media/format";
import type { PanelAnswer } from "@/lib/media/explain";
import type { PersonView, PlanView } from "@/lib/media/view";
import { card } from "./shared";

export default function DotPanel({
  people,
  plan,
  answers,
  selected,
  onSelect,
}: {
  people: PersonView[];
  plan: PlanView;
  answers: PanelAnswer[] | null;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const answerFor = new Map((answers ?? []).map((a) => [a.personaId, a]));
  const index = Math.max(0, people.findIndex((p) => p.id === selected));
  const person = people[index];
  const planChannels = new Map(plan.channels.map((c) => [c.channel, c.label]));
  const inPlan = person.channels.filter((c) => planChannels.has(c)).map((c) => planChannels.get(c)!);
  const reached = plan.reached[index] === 1;
  const answer = answerFor.get(person.id);
  const who = `${person.gender === "kvinna" ? "Kvinna" : "Man"}, ${person.age} år`;

  let status = "Finns inte i planens kanaler";
  if (reached) status = `Ser annonsen via ${listSv(inPlan)}`;
  else if (inPlan.length) status = `Använder ${listSv(inPlan)} men nås inte med den här budgeten`;

  return (
    <div className={card}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <b className="text-[var(--color-primary)]">100 personer ur din målgrupp</b>
        <span className="text-[13px] text-[var(--color-muted-foreground)]">Klicka på en prick</span>
      </div>

      <div className="mb-4 grid grid-cols-10 gap-[clamp(5px,1.1vw,10px)]">
        {people.map((p, i) => {
          const on = plan.reached[i] === 1;
          const isSel = p.id === person.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              aria-pressed={isSel}
              aria-label={`${p.gender === "kvinna" ? "Kvinna" : "Man"}, ${p.age} år, ${on ? "ser annonsen" : "nås inte"}`}
              style={{ transitionDelay: `${(i % 10) * 10 + Math.floor(i / 10) * 14}ms` }}
              className={`relative aspect-square w-full rounded-full border-2 transition-[background-color,border-color,transform] duration-300 hover:scale-110 ${
                on
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                  : "border-[#D9D1BE] bg-transparent"
              } ${isSel ? "shadow-[0_0_0_3px_#fff,0_0_0_5px_var(--color-highlight)]" : ""}`}
            >
              {answerFor.has(p.id) && (
                <span className="absolute -right-[3px] -top-[3px] h-[38%] w-[38%] rounded-full border-2 border-white bg-[var(--color-highlight)]" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--color-muted-foreground)]">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-[11px] w-[11px] rounded-full bg-[var(--color-primary)]" />
          Ser annonsen
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-[11px] w-[11px] rounded-full border-2 border-[#D9D1BE]" />
          Nås inte
        </span>
        {answers && answers.length > 0 && (
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-[11px] w-[11px] rounded-full bg-[var(--color-highlight)]" />
            Har berättat hur de reagerar
          </span>
        )}
      </div>

      <div className="mt-5 rounded-xl bg-[var(--color-muted)] p-4" aria-live="polite">
        <div className="mb-3 flex items-center gap-3">
          <span
            className={`grid h-11 w-11 flex-none place-items-center rounded-full text-lg lining-nums ${
              reached
                ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "border-2 border-dashed border-[#958A7B] text-[var(--color-primary)]"
            }`}
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 600 }}
          >
            {person.age}
          </span>
          <span>
            <b className="block text-[var(--color-primary)]">{who}</b>
            <span className="text-[13px] text-[var(--color-muted-foreground)]">{status}</span>
          </span>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {person.channels.length === 0 && (
            <span className="rounded-full border border-[var(--color-border)] bg-white px-2.5 py-0.5 text-xs font-semibold text-[var(--color-muted-foreground)]">
              Inga uppmätta kanaler
            </span>
          )}
          {person.channels.map((c) => (
            <span
              key={c}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                planChannels.has(c)
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "border-[var(--color-border)] bg-white text-[var(--color-muted-foreground)]"
              }`}
            >
              {CHANNELS[c as ChannelId].label}
            </span>
          ))}
        </div>
        {answer ? (
          <>
            {!reached && (
              <p className="mb-1.5 text-sm text-[var(--color-muted-foreground)]">
                Om annonsen når hen:
              </p>
            )}
            <blockquote
              className="text-[22px] leading-snug text-[var(--color-primary)]"
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 500 }}
            >
              ”{answer.quote}”
            </blockquote>
            <p className="mt-1.5 text-[13px] text-[var(--color-muted-foreground)]">{answer.moment}</p>
          </>
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Syntetisk person. Ålder och medievanor kommer från Mediebarometern 2024 och SCB.
          </p>
        )}
      </div>
    </div>
  );
}
