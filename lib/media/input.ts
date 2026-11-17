import type { Gender } from "./data/mediebarometern-2024";
import { MAX_AGE, MIN_AGE } from "./data/scb-befolkning-2025";
import { LAN_SHARE } from "./data/scb-lan-2024";
import type { PlanRequest } from "./planner";

// Det användaren fyller i under hälsokollet för att få en mediaplan
export interface MediaPlanInput {
  budgetSek: number;
  weeks: number;
  ageMin: number;
  ageMax: number;
  genders: Gender[];
  businessModel: "b2c" | "b2b";
  // Län där kunderna finns. Saknas = hela Sverige.
  region?: string;
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

  if (budgetSek > 0 && budgetSek < MIN_BUDGET) {
    return { ok: false, error: smallBudgetAdvice(budgetSek) };
  }
  if (!(budgetSek >= MIN_BUDGET && budgetSek <= MAX_BUDGET)) {
    return {
      ok: false,
      error: `Budgeten måste vara mellan ${MIN_BUDGET.toLocaleString("sv-SE")} och ${MAX_BUDGET.toLocaleString("sv-SE")} kr`,
    };
  }
  const region = typeof b.region === "string" && b.region !== "" && b.region !== "hela-sverige" ? b.region : undefined;
  if (region && !(region in LAN_SHARE)) {
    return { ok: false, error: "Okänt län" };
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
  return { ok: true, input: { budgetSek, weeks, ageMin, ageMax, genders, businessModel, ...(region ? { region } : {}) } };
}

// Under 10 000 kr blir en plan med flera kanaler meningslös. Kunden får
// i stället råd om var pengarna gör mest nytta.
export function smallBudgetAdvice(budgetSek: number): string {
  return [
    `Budgeten på ${budgetSek.toLocaleString("sv-SE")} kr räcker inte till en mediaplan (minst ${MIN_BUDGET.toLocaleString("sv-SE")} kr). Gör så här i stället:`,
    "1. Fyll i Google-företagsprofilen helt (gratis) och be nöjda kunder om recensioner.",
    "2. Lägg budgeten på sökannonser för era 3–5 viktigaste tjänsteord i ert område.",
    "3. Mät samtal och förfrågningar i en månad innan ni lägger till fler kanaler.",
  ].join("\n");
}

export function requestFromInput(input: MediaPlanInput): PlanRequest {
  const geoShare = input.region ? LAN_SHARE[input.region]?.share : undefined;
  return {
    budgetSek: input.budgetSek,
    target: { ageMin: input.ageMin, ageMax: input.ageMax, genders: input.genders, ...(geoShare ? { geoShare } : {}) },
    businessModel: input.businessModel,
    weeks: input.weeks,
    includeSearch: true,
    ...(input.region ? { regionLabel: LAN_SHARE[input.region].label } : {}),
  };
}
