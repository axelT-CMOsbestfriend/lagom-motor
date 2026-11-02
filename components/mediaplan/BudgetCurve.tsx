"use client";

import { kr, of100 } from "@/lib/media/format";
import type { PlanId } from "@/lib/media/planner";
import type { CurvePoint } from "@/lib/media/view";
import { card } from "./shared";

const W = 340;
const H = 140;
const L = 34;
const R = 10;
const T = 16;
const B = 10;

export default function BudgetCurve({
  curve,
  planId,
  index,
  committedBudget,
  onChange,
}: {
  curve: CurvePoint[];
  planId: PlanId;
  index: number;
  committedBudget: number;
  onChange: (index: number) => void;
}) {
  const budgets = curve.map((p) => p.budgetSek);
  const min = budgets[0];
  const max = budgets[budgets.length - 1];
  const x = (b: number) => L + (max === min ? 0 : ((b - min) / (max - min)) * (W - L - R));
  const y = (v: number) => T + (1 - v) * (H - T - B);

  const reach = curve.map((p) => p.plans.find((pl) => pl.id === planId)!.reach);
  const line = curve.map((p, k) => `${k ? "L" : "M"}${x(p.budgetSek).toFixed(1)},${y(reach[k].mid).toFixed(1)}`).join("");
  const band =
    curve.map((p, k) => `${k ? "L" : "M"}${x(p.budgetSek).toFixed(1)},${y(reach[k].high).toFixed(1)}`).join("") +
    [...curve].reverse().map((p, k) => `L${x(p.budgetSek).toFixed(1)},${y(reach[curve.length - 1 - k].low).toFixed(1)}`).join("") +
    "Z";

  const cur = curve[index];
  const cx = x(cur.budgetSek);
  const cy = y(reach[index].mid);
  const labelX = Math.min(Math.max(cx, L + 40), W - R - 40);
  const committedX = x(committedBudget);

  let marginal = "Längre än så räknar vi inte i den här planen.";
  if (index < curve.length - 1) {
    const next = curve[index + 1];
    const gain = of100(reach[index + 1].mid) - of100(reach[index].mid);
    marginal = `Med ${kr(next.budgetSek - cur.budgetSek)} till når planen ${gain > 0 ? gain : "knappt 1"} ${gain === 1 ? "person" : "personer"} till av 100. Ju mer du lägger, desto färre nya når varje krona.`;
  }

  return (
    <div className={card} id="budgetkurva">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor="mp-curve-budget" className="font-bold text-[var(--color-primary)]">
          Hur mycket ska du lägga?
        </label>
        <output
          htmlFor="mp-curve-budget"
          className="text-[26px] leading-none text-[var(--color-primary)] lining-nums tabular-nums"
          style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 600 }}
        >
          {kr(cur.budgetSek)}
        </output>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-auto w-full overflow-visible" role="img" aria-label="Räckvidd per budget">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--color-muted-foreground)">
              {v * 100}
            </text>
          </g>
        ))}
        <path d={band} fill="rgba(15,13,11,.08)" />
        <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
        <line x1={committedX} x2={committedX} y1={T} y2={H - B} stroke="var(--color-muted-foreground)" strokeDasharray="2 4" />
        <line x1={cx} x2={cx} y1={cy} y2={H - B} stroke="var(--color-primary)" strokeDasharray="3 3" opacity=".5" />
        <circle cx={cx} cy={cy} r="6" fill="var(--color-highlight)" stroke="var(--color-primary)" strokeWidth="2" />
        <text x={labelX} y={Math.max(cy - 12, 12)} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-primary)">
          {of100(reach[index].mid)} av 100
        </text>
      </svg>
      <input
        id="mp-curve-budget"
        type="range"
        min={0}
        max={curve.length - 1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--color-primary)]"
      />
      <div className="flex justify-between text-xs text-[var(--color-muted-foreground)] tabular-nums">
        <span>{kr(min)}</span>
        <span>{kr(max)}</span>
      </div>
      <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
        Linjen visar hur många av 100 i målgruppen som nås. Det skuggade är spannet beroende på
        pris, den streckade linjen din valda budget.
      </p>
      <p className="mt-3 text-sm text-[var(--color-secondary)]">{marginal}</p>
    </div>
  );
}
