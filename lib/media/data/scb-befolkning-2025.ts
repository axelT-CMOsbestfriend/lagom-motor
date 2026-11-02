import type { AgeGroup } from "./mediebarometern-2024";

// Folkmängd i femårsklasser, 2025. Källa: SCB, "Antal kvinnor och män i
// åldersintervall om 5 år, 2025" (Statistikdatabasen, sq/171018),
// publicerad på scb.se/befolkningspyramid-for-sverige 2026-02-24.
export const SCB_SOURCE =
  "SCB, Folkmängd i femårsklasser efter kön, 2025 (Statistikdatabasen sq/171018)";

export interface AgeBand {
  from: number; // inklusive
  to: number; // inklusive
  group: AgeGroup; // motsvarande grupp i Mediebarometern
  kvinna: number;
  man: number;
}

// Mediebarometerns äldsta grupp är 65–85 år; vi använder SCB:s band till 84 år.
export const SCB_BEFOLKNING_2025: AgeBand[] = [
  { from: 15, to: 19, group: "15-24", kvinna: 307_233, man: 327_102 },
  { from: 20, to: 24, group: "15-24", kvinna: 292_992, man: 309_831 },
  { from: 25, to: 29, group: "25-44", kvinna: 295_331, man: 322_689 },
  { from: 30, to: 34, group: "25-44", kvinna: 365_142, man: 380_555 },
  { from: 35, to: 39, group: "25-44", kvinna: 370_261, man: 386_391 },
  { from: 40, to: 44, group: "25-44", kvinna: 325_722, man: 341_441 },
  { from: 45, to: 49, group: "45-64", kvinna: 314_440, man: 324_535 },
  { from: 50, to: 54, group: "45-64", kvinna: 330_114, man: 337_356 },
  { from: 55, to: 59, group: "45-64", kvinna: 328_256, man: 334_908 },
  { from: 60, to: 64, group: "45-64", kvinna: 312_999, man: 317_266 },
  { from: 65, to: 69, group: "65-85", kvinna: 276_697, man: 273_462 },
  { from: 70, to: 74, group: "65-85", kvinna: 258_943, man: 246_349 },
  { from: 75, to: 79, group: "65-85", kvinna: 259_399, man: 236_725 },
  { from: 80, to: 84, group: "65-85", kvinna: 203_242, man: 176_531 },
];

export const MIN_AGE = SCB_BEFOLKNING_2025[0].from;
export const MAX_AGE = SCB_BEFOLKNING_2025[SCB_BEFOLKNING_2025.length - 1].to;
