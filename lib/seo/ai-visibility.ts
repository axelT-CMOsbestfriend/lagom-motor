import { askJsonWithWebSearch, summarizeCrawl } from "../claude";
import { mentionsCompany, type SeoContext } from "./context";

// Syns bolaget när en kund frågar en AI-assistent? Claude tar fram åtta
// typiska köpfrågor, söker på webben som en assistent skulle göra och
// listar vilka bolag svaren lyfter fram. Om kunden nämns räknar vi själva.

export interface AiVisibilityResult {
  score: number;
  questions: { question: string; mentioned: boolean; companiesMentioned: string[] }[];
  competitors: { name: string; mentions: number }[];
}

const SYSTEM = `Du simulerar en AI-assistent som en svensk kund frågar innan ett köp.

1. Utifrån sajten nedan: formulera exakt 8 frågor som en potentiell kund skulle ställa till en AI-assistent när hen letar efter det bolaget säljer, t.ex. "bästa X i Y" eller "vad kostar X". Nämn INTE bolagets namn i frågorna.
2. Besvara varje fråga med webbsökning, som en assistent skulle göra.
3. Lista för varje fråga de bolag eller sajter som ditt svar skulle rekommendera eller nämna, med namn och gärna domän, t.ex. "Exempel AB (exempel.se)".

Var ärlig: nämn bara bolag som sökresultaten faktiskt stöder.

Svara med ENDAST JSON:
{"questions": [{"question": "...", "companiesMentioned": ["Namn (domän)", ...]}]}`;

export async function checkAiVisibility(ctx: SeoContext): Promise<AiVisibilityResult> {
  const user = [
    `Bolag: ${ctx.companyName}`,
    ctx.location ? `Ort/marknad: ${ctx.location}` : "",
    "",
    summarizeCrawl({ ...ctx.crawl, pages: ctx.crawl.pages.slice(0, 3) }),
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await askJsonWithWebSearch<{
    questions: { question: string; companiesMentioned: string[] }[];
  }>(SYSTEM, user, 10);

  const questions = raw.questions.slice(0, 8).map((q) => ({
    question: q.question,
    companiesMentioned: q.companiesMentioned ?? [],
    mentioned: mentionsCompany(ctx, q.companiesMentioned ?? []),
  }));

  const counts = new Map<string, number>();
  for (const q of questions) {
    for (const c of q.companiesMentioned) {
      if (mentionsCompany(ctx, [c])) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const competitors = [...counts]
    .map(([name, mentions]) => ({ name, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 5);

  const hits = questions.filter((q) => q.mentioned).length;
  return {
    score: questions.length ? Math.round((hits / questions.length) * 100) : 0,
    questions,
    competitors,
  };
}
