// Regelboken: det Claude får hänvisa till när planen motiveras.
// kind = "forskning": publicerad källa med författare och år
// kind = "data": följer direkt av mätdata i modellen
// kind = "heuristik": Marknadspilotens egen tumregel, ska valideras (M5)

export type RuleKind = "forskning" | "data" | "heuristik";

export interface RuleSource {
  author: string;
  year: number | null;
  title: string;
  publisher?: string;
}

export interface Rule {
  id: string;
  kind: RuleKind;
  claim: string;
  implication: string;
  source: RuleSource;
}

export const RULES = [
  {
    id: "BF-01",
    kind: "forskning",
    claim:
      "Över tid ger en fördelning på ungefär 60 % varumärkesbyggande och 40 % säljaktivering bäst total effekt för konsumentvarumärken.",
    implication:
      "En plan som bara består av aktivering ger snabb effekt men sämre tillväxt på sikt. Planen bör ha en bred räckviddsdel.",
    source: {
      author: "Binet, L. & Field, P.",
      year: 2013,
      title: "The Long and the Short of It",
      publisher: "IPA",
    },
  },
  {
    id: "BF-02",
    kind: "forskning",
    claim:
      "För B2B ligger den effektivaste fördelningen närmare 46 % varumärke och 54 % aktivering.",
    implication:
      "B2B-bolag kan lägga en större del på riktad aktivering än konsumentbolag, men inte allt.",
    source: {
      author: "Binet, L. & Field, P.",
      year: 2019,
      title: "The 5 Principles of Growth in B2B Marketing",
      publisher: "LinkedIn B2B Institute",
    },
  },
  {
    id: "BF-03",
    kind: "forskning",
    claim:
      "Aktivering ger försäljning på kort sikt men effekten klingar av snabbt. Varumärkesbyggande ger mindre direkt effekt men bygger efterfrågan över tid.",
    implication:
      "Aktiveringsplanen passar när målet är försäljning inom kampanjperioden. Räckviddsplanen passar när målet är tillväxt över året.",
    source: {
      author: "Binet, L. & Field, P.",
      year: 2013,
      title: "The Long and the Short of It",
      publisher: "IPA",
    },
  },
  {
    id: "ESOV-01",
    kind: "forskning",
    claim:
      "Varumärken vars andel av reklamtrycket (share of voice) är större än deras marknadsandel tenderar att växa.",
    implication:
      "Ett litet bolag vinner sällan share of voice i samma kanal som större konkurrenter. Det kan vara billigare att synas där konkurrenterna inte är.",
    source: {
      author: "Jones, J. P.",
      year: 1990,
      title: "Ad Spending: Maintaining Market Share",
      publisher: "Harvard Business Review",
    },
  },
  {
    id: "EB-01",
    kind: "forskning",
    claim:
      "Varumärken växer främst genom att fler köper (penetration), inte genom att befintliga köpare köper mer.",
    implication:
      "Räckvidd i hela målgruppen, inklusive lätta och icke-köpare, är viktigare än hög frekvens mot ett smalt segment.",
    source: {
      author: "Sharp, B.",
      year: 2010,
      title: "How Brands Grow",
      publisher: "Oxford University Press",
    },
  },
  {
    id: "EB-02",
    kind: "forskning",
    claim:
      "Mental tillgänglighet byggs genom att varumärket kopplas till de situationer där köpbehov uppstår (category entry points).",
    implication:
      "Kanaler som når människor i vardagssituationer nära köpbehovet, till exempel radio i bilen eller flöden på kvällen, kan motiveras även om de inte är mest effektiva per krona.",
    source: {
      author: "Romaniuk, J. & Sharp, B.",
      year: 2016,
      title: "How Brands Grow: Part 2",
      publisher: "Oxford University Press",
    },
  },
  {
    id: "FREQ-01",
    kind: "forskning",
    claim:
      "Tre exponeringar beskrivs som tröskeln där budskapet går från att uppmärksammas till att övervägas.",
    implication:
      "Aktiveringsplanen optimeras mot andelen som ser annonsen minst tre gånger.",
    source: {
      author: "Krugman, H. E.",
      year: 1972,
      title: "Why Three Exposures May Be Enough",
      publisher: "Journal of Advertising Research",
    },
  },
  {
    id: "REC-01",
    kind: "forskning",
    claim:
      "En enda exponering nära köptillfället kan räcka för att påverka köp. Kontinuerlig närvaro slår korta, intensiva pulser för varor som köps ofta.",
    implication:
      "Hög frekvens är inte alltid värd priset. Räckvidd spridd över tid kan vara bättre än 3+ på kort tid.",
    source: {
      author: "Jones, J. P.",
      year: 1995,
      title: "When Ads Work",
      publisher: "Lexington Books",
    },
  },
  {
    id: "ATT-01",
    kind: "forskning",
    claim:
      "Uppmärksamheten per visning skiljer sig kraftigt mellan format. Helskärmsvideo och tv får mer aktiv uppmärksamhet än annonser i flöden.",
    implication:
      "En billig visning i ett flöde är inte lika mycket värd som en visning i tv eller helskärmsvideo. Räckvidden per krona säger inte allt.",
    source: {
      author: "Nelson-Field, K.",
      year: 2020,
      title: "The Attention Economy and How Media Works",
      publisher: "Palgrave Macmillan",
    },
  },
  {
    id: "NBD-01",
    kind: "forskning",
    claim:
      "Exponering fördelar sig ojämnt: tunga användare ser många annonser medan många lätta användare ser få eller inga.",
    implication:
      "Räckvidden planar ut när budgeten ökar i en och samma kanal. Nästa krona gör ofta mer nytta i en ny kanal.",
    source: {
      author: "Ehrenberg, A. S. C.",
      year: 1972,
      title: "Repeat-Buying: Theory and Applications",
      publisher: "North-Holland",
    },
  },
  {
    id: "DATA-01",
    kind: "data",
    claim:
      "Andelen av målgruppen som använder en kanal en vanlig dag sätter taket för hur många kanalen kan nå.",
    implication:
      "En kanal som få i målgruppen använder kan inte nå dem, oavsett budget.",
    source: {
      author: "Nordicom, Göteborgs universitet",
      year: 2025,
      title: "Mediebarometern 2024",
    },
  },
  {
    id: "DATA-02",
    kind: "data",
    claim:
      "Kanaler som inte kan riktas mot ålder och kön visar annonsen för hela sin publik. Visningar utanför målgruppen är spill.",
    implication:
      "Linjär tv, radio och tryck blir dyrare per nådd målgruppsperson ju smalare målgruppen är.",
    source: {
      author: "Nordicom, Göteborgs universitet",
      year: 2025,
      title: "Mediebarometern 2024",
    },
  },
  {
    id: "H-01",
    kind: "heuristik",
    claim:
      "En kanal tas bara med om minst 15 % av målgruppen använder den en vanlig dag.",
    implication: "Kanaler under tröskeln tas inte med i planerna.",
    source: {
      author: "Marknadspiloten",
      year: null,
      title: "Egen tumregel, ska valideras",
    },
  },
  {
    id: "H-02",
    kind: "heuristik",
    claim:
      "Varje kanal behöver runt 25 000 kr för att göra märkbar skillnad. Budgeten sprids därför på högst en kanal per 25 000 kr, max fem.",
    implication: "Små budgetar koncentreras till få kanaler.",
    source: {
      author: "Marknadspiloten",
      year: null,
      title: "Egen tumregel, ska valideras",
    },
  },
] as const satisfies readonly Rule[];

export type RuleId = (typeof RULES)[number]["id"];

export const RULE_IDS = RULES.map((r) => r.id) as RuleId[];

export function getRule(id: string): Rule | undefined {
  return (RULES as readonly Rule[]).find((r) => r.id === id);
}

export function formatSource(s: RuleSource): string {
  const year = s.year === null ? "" : ` (${s.year})`;
  const publisher = s.publisher ? `, ${s.publisher}` : "";
  return `${s.author}${year}. ${s.title}${publisher}`;
}
