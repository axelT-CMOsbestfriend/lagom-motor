// Folkmängd per län 31 december 2025. Källa: SCB, Befolkningstäthet i
// Sverige, tabellen "Befolkningstäthet i olika län 2025" (Statistikdatabasen
// sq/134514, publicerad 2026-02-24). Andelen räknas mot summan av länen.
export const SCB_LAN_SOURCE = "SCB, Folkmängd per län 31 december 2025 (Statistikdatabasen sq/134514)";

const LAN_POPULATION: Record<string, { label: string; population: number }> = {
  stockholm: { label: "Stockholms län", population: 2_486_251 },
  uppsala: { label: "Uppsala län", population: 410_575 },
  sodermanland: { label: "Södermanlands län", population: 300_440 },
  ostergotland: { label: "Östergötlands län", population: 472_529 },
  jonkoping: { label: "Jönköpings län", population: 369_722 },
  kronoberg: { label: "Kronobergs län", population: 203_121 },
  kalmar: { label: "Kalmar län", population: 245_477 },
  gotland: { label: "Gotlands län", population: 60_852 },
  blekinge: { label: "Blekinge län", population: 156_616 },
  skane: { label: "Skåne län", population: 1_433_083 },
  halland: { label: "Hallands län", population: 346_090 },
  vastragotaland: { label: "Västra Götalands län", population: 1_777_803 },
  varmland: { label: "Värmlands län", population: 283_037 },
  orebro: { label: "Örebro län", population: 308_357 },
  vastmanland: { label: "Västmanlands län", population: 280_756 },
  dalarna: { label: "Dalarnas län", population: 286_043 },
  gavleborg: { label: "Gävleborgs län", population: 283_452 },
  vasternorrland: { label: "Västernorrlands län", population: 240_640 },
  jamtland: { label: "Jämtlands län", population: 132_736 },
  vasterbotten: { label: "Västerbottens län", population: 279_028 },
  norrbotten: { label: "Norrbottens län", population: 248_927 },
};

export const SWEDEN_POPULATION_2025 = Object.values(LAN_POPULATION).reduce((s, l) => s + l.population, 0);

export const LAN_SHARE: Record<string, { label: string; share: number; population: number }> = Object.fromEntries(
  Object.entries(LAN_POPULATION).map(([id, l]) => [id, { ...l, share: l.population / SWEDEN_POPULATION_2025 }])
);
