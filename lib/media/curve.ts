import { MAX_BUDGET, MIN_BUDGET } from "./input";

const FACTORS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

function roundBudget(x: number): number {
  const step = x >= 100_000 ? 10_000 : 5_000;
  return Math.round(x / step) * step;
}

// Budgetnivåerna som räckviddskurvan räknas för: från en fjärdedel till tre
// gånger den valda budgeten. Den valda budgeten finns alltid med exakt.
export function budgetGrid(budgetSek: number): number[] {
  const points = new Set<number>([budgetSek]);
  for (const f of FACTORS) {
    const b = roundBudget(budgetSek * f);
    if (b >= MIN_BUDGET && b <= MAX_BUDGET) points.add(b);
  }
  return [...points].sort((a, b) => a - b);
}
