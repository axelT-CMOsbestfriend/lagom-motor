import type { Brief } from "../types";
import type { Gender } from "./data/mediebarometern-2024";
import { MAX_AGE, MIN_AGE } from "./data/scb-befolkning-2025";

export interface TargetGuess {
  ageMin: number;
  ageMax: number;
  genders: Gender[];
  // true om något i briefen faktiskt pekade ut målgruppen
  fromBrief: boolean;
}

export const DEFAULT_TARGET: TargetGuess = {
  ageMin: 25,
  ageMax: 64,
  genders: ["kvinna", "man"],
  fromBrief: false,
};

const clampAge = (n: number) => Math.min(MAX_AGE, Math.max(MIN_AGE, n));

// Enkel tolkning av briefen: letar efter åldersspann ("25–45 år") och kön.
// Hittas inget används ett brett standardval, och gränssnittet säger det.
export function guessTarget(brief: Pick<Brief, "goal" | "industry" | "followUps">): TargetGuess {
  const text = [brief.goal, brief.industry, ...brief.followUps.map((f) => f.answer)]
    .join(" ")
    .toLowerCase();

  let ageMin = DEFAULT_TARGET.ageMin;
  let ageMax = DEFAULT_TARGET.ageMax;
  let fromBrief = false;

  const range = text.match(/(\d{2})\s*(?:–|-|till)\s*(\d{2})\s*år/);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y);
    ageMin = clampAge(a);
    ageMax = clampAge(b);
    fromBrief = ageMin < ageMax;
  }

  const women = /\b(kvinnor|tjejer|mammor|damer)\b/.test(text);
  const men = /\b(män|killar|pappor|herrar)\b/.test(text);
  let genders: Gender[] = ["kvinna", "man"];
  if (women !== men) {
    genders = women ? ["kvinna"] : ["man"];
    fromBrief = true;
  }

  if (!fromBrief) return DEFAULT_TARGET;
  return { ageMin, ageMax, genders, fromBrief };
}
