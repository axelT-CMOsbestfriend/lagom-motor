import type { Gender } from "./data/mediebarometern-2024";
import { MAX_AGE, MIN_AGE } from "./data/scb-befolkning-2025";
import type { PlanRequest } from "./planner";

// Det användaren fyller i under hälsokollet för att få en mediaplan
export interface MediaPlanInput {
  budgetSek: number;
  weeks: number;
  ageMin: number;
  ageMax: number;
  genders: Gender[];
  businessModel: "b2c" | "b2b";
}

export const MIN_BUDGET = 10_000;
export const MAX_BUDGET = 50_000_000;

export type ParseResult = { ok: true; input: MediaPlanInput } | { ok: false; error: string };

function int(value: unknown): number {
  const n = typeof value === "string" ? Number(value.replace(/\s/g, "")) : Number(value);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export function parseMediaPlanInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const budgetSek = int(b.budgetSek);
  const weeks = int(b.weeks);
  const ageMin = int(b.ageMin);
  const ageMax = int(b.ageMax);
  const genders = Array.isArray(b.genders)
    ? [...new Set(b.genders.filter((g): g is Gender => g === "kvinna" || g === "man"))]
    : [];
  const businessModel = b.businessModel;

  if (!(budgetSek >= MIN_BUDGET && budgetSek <= MAX_BUDGET)) {
    return {
      ok: false,
      error: `Budgeten måste vara mellan ${MIN_BUDGET.toLocaleString("sv-SE")} och ${MAX_BUDGET.toLocaleString("sv-SE")} kr`,
    };
  }
  if (!(weeks >= 1 && weeks <= 52)) {
    return { ok: false, error: "Perioden måste vara mellan 1 och 52 veckor" };
  }
  if (!(ageMin >= MIN_AGE && ageMax <= MAX_AGE && ageMin <= ageMax)) {
    return { ok: false, error: `Åldern måste ligga mellan ${MIN_AGE} och ${MAX_AGE} år` };
  }
  if (genders.length === 0) {
    return { ok: false, error: "Välj minst ett kön" };
  }
  if (businessModel !== "b2c" && businessModel !== "b2b") {
    return { ok: false, error: "Välj om ni säljer till konsumenter eller företag" };
  }
  return { ok: true, input: { budgetSek, weeks, ageMin, ageMax, genders, businessModel } };
}

export function requestFromInput(input: MediaPlanInput): PlanRequest {
  return {
    budgetSek: input.budgetSek,
    target: { ageMin: input.ageMin, ageMax: input.ageMax, genders: input.genders },
    businessModel: input.businessModel,
  };
}
