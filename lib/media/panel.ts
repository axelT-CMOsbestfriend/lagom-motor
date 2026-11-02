import {
  CHANNEL_IDS,
  dailyReach,
  type AgeGroup,
  type ChannelId,
  type Gender,
} from "./data/mediebarometern-2024";
import {
  MAX_AGE,
  MIN_AGE,
  SCB_BEFOLKNING_2025,
  type AgeBand,
} from "./data/scb-befolkning-2025";
import { createRng } from "./random";

export interface TargetGroup {
  ageMin: number;
  ageMax: number;
  genders: Gender[];
  // Andel av Sveriges befolkning som bor i målområdet (1 = hela landet)
  geoShare?: number;
}

export interface Persona {
  id: string;
  age: number;
  gender: Gender;
  ageGroup: AgeGroup;
  // Kanaler personen använder en vanlig dag
  channels: ChannelId[];
}

export interface Panel {
  target: TargetGroup;
  seed: number;
  // Antal verkliga personer i målgruppen som panelen representerar
  targetPopulation: number;
  personas: Persona[];
}

export interface PopulationCell {
  band: AgeBand;
  gender: Gender;
  ageFrom: number;
  ageTo: number;
  population: number;
}

export const ALL_ADULTS: TargetGroup = {
  ageMin: MIN_AGE,
  ageMax: MAX_AGE,
  genders: ["kvinna", "man"],
};

export function validateTarget(target: TargetGroup): void {
  if (target.genders.length === 0) {
    throw new Error("Målgruppen måste innehålla minst ett kön");
  }
  if (target.ageMin < MIN_AGE || target.ageMax > MAX_AGE) {
    throw new Error(`Åldern måste ligga mellan ${MIN_AGE} och ${MAX_AGE} år`);
  }
  if (target.ageMin > target.ageMax) {
    throw new Error("ageMin kan inte vara större än ageMax");
  }
  const geo = target.geoShare ?? 1;
  if (!(geo > 0 && geo <= 1)) {
    throw new Error("geoShare måste vara större än 0 och högst 1");
  }
}

// Målgruppens befolkning per femårsklass och kön. Band som bara delvis
// ligger inom åldersspannet räknas proportionellt (jämn fördelning i bandet).
export function targetCells(target: TargetGroup): PopulationCell[] {
  validateTarget(target);
  const geo = target.geoShare ?? 1;
  const cells: PopulationCell[] = [];
  for (const band of SCB_BEFOLKNING_2025) {
    const ageFrom = Math.max(band.from, target.ageMin);
    const ageTo = Math.min(band.to, target.ageMax);
    if (ageFrom > ageTo) continue;
    const overlap = (ageTo - ageFrom + 1) / (band.to - band.from + 1);
    for (const gender of target.genders) {
      cells.push({
        band,
        gender,
        ageFrom,
        ageTo,
        population: band[gender] * overlap * geo,
      });
    }
  }
  return cells;
}

export function populationOf(target: TargetGroup): number {
  return targetCells(target).reduce((sum, c) => sum + c.population, 0);
}

// Förväntat antal personer i målgruppen som använder kanalen en vanlig dag
export function channelAudience(target: TargetGroup, channel: ChannelId): number {
  return targetCells(target).reduce(
    (sum, c) => sum + c.population * dailyReach(channel, c.band.group, c.gender),
    0
  );
}

export function createPanel(
  target: TargetGroup,
  options: { size?: number; seed?: number } = {}
): Panel {
  const size = options.size ?? 2000;
  const seed = options.seed ?? 1;
  const rng = createRng(seed);
  const cells = targetCells(target);
  const total = cells.reduce((sum, c) => sum + c.population, 0);

  const personas: Persona[] = [];
  for (let i = 0; i < size; i++) {
    // Dra en cell viktat efter befolkning
    let pick = rng() * total;
    let cell = cells[cells.length - 1];
    for (const c of cells) {
      pick -= c.population;
      if (pick < 0) {
        cell = c;
        break;
      }
    }
    const age = cell.ageFrom + Math.floor(rng() * (cell.ageTo - cell.ageFrom + 1));
    const channels = CHANNEL_IDS.filter(
      (ch) => rng() < dailyReach(ch, cell.band.group, cell.gender)
    );
    personas.push({
      id: `p${i + 1}`,
      age,
      gender: cell.gender,
      ageGroup: cell.band.group,
      channels,
    });
  }

  return { target, seed, targetPopulation: total, personas };
}
