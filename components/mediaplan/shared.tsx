"use client";

import type { PlanId } from "@/lib/media/planner";
import type { MediaPlanRecord } from "@/lib/media/view";

export function logEvent(name: string, analysisId: string) {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, analysisId }),
  }).catch(() => {});
}

// Korta beskrivningar för flikarna. Namnen kommer från planeraren.
export const PLAN_BLURB: Record<PlanId, string> = {
  rackvidd: "Så många som möjligt ser annonsen minst en gång.",
  aktivering: "Något färre, men fler ser annonsen flera gånger.",
  luckan: "Bara kanaler där konkurrenterna inte syns.",
};

// Färger för kanalerna i fördelningen, från mörkast till ljusast
export const SEGMENT_COLORS = ["#0F0D0B", "#5A5148", "#958A7B", "#BFB5A3", "#DDD5C3"];

export const inProgress = (mp: MediaPlanRecord | null | undefined) =>
  mp?.status === "running" || mp?.status === "explaining";

export const card =
  "rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-[0_1px_2px_rgba(15,13,11,.05),0_10px_30px_rgba(15,13,11,.06)] sm:p-6";

export const eyebrow =
  "mb-2 text-xs font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]";

export const chipButton =
  "rounded-full bg-[var(--color-muted)] px-3 py-1 text-[13px] font-bold text-[var(--color-primary)] transition hover:bg-[var(--color-border)]";

export const primaryButton =
  "rounded-lg bg-[var(--color-primary)] px-4 py-2.5 font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50";

export const secondaryButton =
  "rounded-lg border border-[var(--color-primary)] px-4 py-2.5 font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-muted)]";

export function Row({
  icon,
  label,
  value,
  action,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[40px_1fr_auto] items-center gap-3 border-b border-[var(--color-border)] py-3 last:border-b-0">
      <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-primary)]">
        {icon}
      </span>
      <span>
        <small className="block text-[13px] text-[var(--color-muted-foreground)]">{label}</small>
        <span className="font-semibold text-[var(--color-primary)] tabular-nums">{value}</span>
      </span>
      {action ?? <span />}
      {children && <div className="col-start-2 col-end-4">{children}</div>}
    </li>
  );
}
