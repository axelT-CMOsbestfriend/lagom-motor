import type { PlanRequest } from "../../../lib/media/planner";

// Förfrågan som fixturerna i den här mappen hör till. Ändras planeraren så
// att fakta-ID:n eller kanaler byts ut, faller fixturtesterna.
export const FIXTURE_REQUEST: PlanRequest = {
  budgetSek: 200_000,
  target: { ageMin: 25, ageMax: 44, genders: ["kvinna", "man"] },
  businessModel: "b2c",
};

export const FIXTURE_BRIEF = {
  companyName: "Exempelbolaget",
  industry: "Kafé och bageri",
  goal: "Fler kunder till nya caféet i centrum",
};
