// Texter som räknas fram direkt ur simuleringen: följdfrågor och
// motiveringar för planer som Claude inte har motiverat. Inga påhittade
// siffror, bara det som står i vyn.
import type { ChannelId } from "./data/mediebarometern-2024";
import { kr, listSv, of100 } from "./format";
import type { MediaPlanInput } from "./input";
import type { MediaPlanView, PlanView } from "./view";

export interface QuestionAnswer {
  question: string;
  answer: string;
}

const BUYING_TOOL: Record<ChannelId, string> = {
  facebook: "Metas annonshanterare",
  instagram: "Metas annonshanterare",
  snapchat: "Snapchats annonshanterare",
  tiktok: "Tiktoks annonshanterare",
  linkedin: "Linkedin Campaign Manager",
  youtube: "Google Ads",
  tv4: "TV4:s säljavdelning",
  tv4play: "TV4:s säljavdelning",
  reklamradio: "radiobolagens säljare",
  podd: "poddnätverken",
  morgontidning: "tidningarnas annonsavdelningar",
  kvallstidning: "tidningarnas annonsavdelningar",
  tidskrift: "tidningarnas annonsavdelningar",
};

export function howToBuy(plan: PlanView): string {
  const byTool = new Map<string, string[]>();
  for (const c of plan.channels) {
    const tool = BUYING_TOOL[c.channel];
    byTool.set(tool, [...(byTool.get(tool) ?? []), c.label]);
  }
  return [...byTool].map(([tool, labels]) => `${listSv(labels)} i ${tool}`).join(", ");
}

export function followUps(
  view: MediaPlanView,
  plan: PlanView,
  input: MediaPlanInput
): QuestionAnswer[] {
  const out: QuestionAnswer[] = [];
  const total = kr(plan.totalBudgetSek);

  if (plan.topChannelOnly) {
    const only = plan.topChannelOnly;
    const diff = of100(plan.reach.mid) - of100(only.reachShare);
    out.push({
      question: `Vad händer om jag bara kör ${only.label}?`,
      answer:
        diff > 0
          ? `Med ${total} bara på ${only.label} ser ungefär ${of100(only.reachShare)} av 100 annonsen, mot ${of100(plan.reach.mid)} av 100 med den här planen. Räckvidden i en kanal planar ut: efter ett tag ser samma personer annonsen igen i stället för att nya tillkommer.`
          : `Med ${total} bara på ${only.label} ser ungefär ${of100(only.reachShare)} av 100 annonsen, lika många som med den här planen. Planen sprider pengarna för att nå fler olika personer eller för att synas där konkurrenterna inte är.`,
    });
  }

  const missing = [...view.excluded].sort((a, b) => b.penetration - a.penetration)[0];
  if (missing) {
    out.push({
      question: `Varför inte ${missing.label}?`,
      answer: `Bara ${of100(missing.penetration)} av 100 i din målgrupp använder ${missing.label} en vanlig dag. Kanaler som färre än 15 av 100 använder tar vi inte med, eftersom de inte kan nå tillräckligt många oavsett budget.`,
    });
  }

  out.push({
    question: "Kan jag sköta det här själv?",
    answer: `Ja. Du köper ${howToBuy(plan)}. Lägg budgeten per kanal enligt fördelningen och ställ in målgruppen på ${input.ageMin}–${input.ageMax} år. Vill du ha hjälp att sätta upp det kan du boka en genomgång.`,
  });
  return out;
}

export function computedReasons(view: MediaPlanView, plan: PlanView) {
  return [...plan.channels]
    .sort((a, b) => b.budgetSek - a.budgetSek)
    .map((c) => {
      const pen = view.penetration[c.channel];
      const usage =
        pen === undefined
          ? ""
          : `${of100(pen)} av 100 i din målgrupp använder ${c.label} en vanlig dag. `;
      return {
        channel: c.channel,
        label: c.label,
        text: `${usage}${kr(c.budgetSek)} här når ${of100(c.reachShare)} av 100.`,
      };
    });
}
