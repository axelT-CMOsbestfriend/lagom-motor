import { MEDIEBAROMETERN_2024, type ChannelId } from "./data/mediebarometern-2024";

export interface Assumption {
  id: string;
  text: string;
  // Källa när antagandet är belagt, annars null
  source: string | null;
  verified: boolean;
}

export interface ChannelSpec {
  id: ChannelId;
  label: string;
  // Kan köpet riktas mot målgruppens ålder och kön? Om inte sprids
  // visningarna över kanalens hela vuxna publik i Sverige.
  targetable: boolean;
  // Kostnad per tusen visningar i SEK, intervall
  cpmSek: { low: number; high: number };
  cpmAssumption: Assumption;
}

function cpm(id: ChannelId, low: number, high: number, basis: string) {
  return {
    cpmSek: { low, high },
    cpmAssumption: {
      id: `cpm-${id}`,
      text: `CPM ${MEDIEBAROMETERN_2024[id].label}: ${low}–${high} kr (${basis})`,
      source: null,
      verified: false,
    } satisfies Assumption,
  };
}

// CPM-intervallen är grova startvärden och INTE källbelagda. De ska
// verifieras (t.ex. mot räckviddsestimat i Meta Ads Manager och publicisternas
// prislistor) innan modulen räknas som klar, se docs/mediaplan-mal.md.
export const CHANNELS: Record<ChannelId, ChannelSpec> = {
  facebook: { id: "facebook", label: "Facebook", targetable: true, ...cpm("facebook", 40, 110, "auktion, varierar med säsong") },
  instagram: { id: "instagram", label: "Instagram", targetable: true, ...cpm("instagram", 45, 120, "auktion, varierar med säsong") },
  snapchat: { id: "snapchat", label: "Snapchat", targetable: true, ...cpm("snapchat", 30, 90, "auktion") },
  tiktok: { id: "tiktok", label: "Tiktok", targetable: true, ...cpm("tiktok", 30, 100, "auktion") },
  linkedin: { id: "linkedin", label: "Linkedin", targetable: true, ...cpm("linkedin", 250, 600, "auktion, B2B-premie") },
  youtube: { id: "youtube", label: "Youtube", targetable: true, ...cpm("youtube", 60, 160, "instream, auktion") },
  tv4: { id: "tv4", label: "TV4 (tablålagd)", targetable: false, ...cpm("tv4", 200, 400, "kontaktpris linjär tv") },
  tv4play: { id: "tv4play", label: "TV4 Play", targetable: true, ...cpm("tv4play", 250, 450, "AVOD med demografisk styrning") },
  reklamradio: { id: "reklamradio", label: "Reklamradio", targetable: false, ...cpm("reklamradio", 60, 150, "nationell radio") },
  podd: { id: "podd", label: "Podd", targetable: false, ...cpm("podd", 200, 400, "inlästa eller dynamiska spots") },
  morgontidning: { id: "morgontidning", label: "Morgontidning", targetable: false, ...cpm("morgontidning", 100, 300, "digital display och print") },
  kvallstidning: { id: "kvallstidning", label: "Kvällstidning", targetable: false, ...cpm("kvallstidning", 80, 200, "digital display") },
  tidskrift: { id: "tidskrift", label: "Tidskrift", targetable: false, ...cpm("tidskrift", 300, 700, "print") },
};

// Hur ojämnt visningar fördelas mellan personerna i publiken. Negativ
// binomialfördelning (NBD), Ehrenbergs klassiska modell för exponering.
// k = 1 innebär att tunga användare ser betydligt fler visningar än lätta.
export const NBD_K = 1;

export const MODEL_ASSUMPTIONS: Assumption[] = [
  {
    id: "daglig-rackvidd-som-publik",
    text: "Daglig räckvidd används som andelen i målgruppen som går att nå i kanalen. Konservativt för kampanjer längre än en dag.",
    source: "Mediebarometern 2024 (Nordicom), bearbetning",
    verified: true,
  },
  {
    id: "oberoende-kanaler",
    text: "Kanalanvändning antas oberoende inom en ålders- och könsgrupp.",
    source: null,
    verified: false,
  },
  {
    id: "nbd-k",
    text: `Exponering per person följer en negativ binomialfördelning med k = ${NBD_K}.`,
    source: "Ehrenberg, Repeat-Buying (1972); NBD-modellen för medieexponering",
    verified: false,
  },
  {
    id: "riktbarhet",
    text: "Sociala medier, Youtube och TV4 Play kan riktas mot ålder och kön utan spill. Övriga kanaler sprids över hela sin vuxna publik.",
    source: null,
    verified: false,
  },
];
