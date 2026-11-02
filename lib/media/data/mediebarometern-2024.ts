// Daglig räckvidd (procent) per åldersgrupp och kön, avskrivet ur
// Mediebarometern 2024 (Nordicom, Göteborgs universitet), 6 021 svarande 9–85 år.
// https://www.nordicom.gu.se/sv/publikationer/mediebarometern-2024
//
// Nordicom kräver att källa och sidnummer anges, och att egna bearbetningar
// redovisas. Bearbetning här: vi använder bara grupperna 15–85 år och
// behandlar daglig räckvidd som sannolikheten att en person i gruppen
// använder kanalen (se docs/mediaplan-mal.md).

export type AgeGroup = "15-24" | "25-44" | "45-64" | "65-85";
export type Gender = "kvinna" | "man";

export const AGE_GROUPS: AgeGroup[] = ["15-24", "25-44", "45-64", "65-85"];
export const GENDERS: Gender[] = ["kvinna", "man"];

export interface ReachCell {
  kvinna: number;
  man: number;
  totalt: number;
}

export interface ReachTable {
  label: string;
  source: string;
  note?: string;
  byGroup: Record<AgeGroup, ReachCell>;
}

const MB = "Mediebarometern 2024 (Nordicom, Göteborgs universitet)";

function row(kvinna: number, man: number, totalt: number): ReachCell {
  return { kvinna, man, totalt };
}

export const MEDIEBAROMETERN_2024 = {
  facebook: {
    label: "Facebook",
    source: `${MB}, Sociala nätverkstjänster: Daglig räckvidd, s. 86 ff.`,
    byGroup: {
      "15-24": row(46, 37, 41),
      "25-44": row(83, 67, 75),
      "45-64": row(76, 63, 69),
      "65-85": row(63, 53, 58),
    },
  },
  instagram: {
    label: "Instagram",
    source: `${MB}, Sociala nätverkstjänster: Daglig räckvidd, s. 86 ff.`,
    byGroup: {
      "15-24": row(89, 67, 78),
      "25-44": row(85, 61, 73),
      "45-64": row(71, 43, 56),
      "65-85": row(50, 29, 39),
    },
  },
  snapchat: {
    label: "Snapchat",
    source: `${MB}, Sociala nätverkstjänster: Daglig räckvidd, s. 86 ff.`,
    byGroup: {
      "15-24": row(88, 80, 83),
      "25-44": row(33, 24, 28),
      "45-64": row(21, 11, 16),
      "65-85": row(5, 3, 4),
    },
  },
  tiktok: {
    label: "Tiktok",
    source: `${MB}, Sociala nätverkstjänster: Daglig räckvidd, s. 86 ff.`,
    byGroup: {
      "15-24": row(79, 55, 67),
      "25-44": row(16, 10, 13),
      "45-64": row(6, 6, 6),
      "65-85": row(1, 3, 2),
    },
  },
  linkedin: {
    label: "Linkedin",
    source: `${MB}, Sociala nätverkstjänster: Daglig räckvidd, s. 86 ff.`,
    byGroup: {
      "15-24": row(8, 8, 8),
      "25-44": row(23, 26, 25),
      "45-64": row(17, 26, 22),
      "65-85": row(3, 7, 5),
    },
  },
  youtube: {
    label: "Youtube",
    source: `${MB}, Rörlig bild: Daglig räckvidd, s. 36 ff.`,
    byGroup: {
      "15-24": row(72, 90, 81),
      "25-44": row(39, 70, 54),
      "45-64": row(22, 49, 36),
      "65-85": row(12, 27, 19),
    },
  },
  tv4: {
    label: "TV4 (tablålagd)",
    source: `${MB}, Tv-kanaler: Daglig räckvidd, s. 42 ff.`,
    byGroup: {
      "15-24": row(21, 16, 18),
      "25-44": row(21, 19, 20),
      "45-64": row(47, 46, 47),
      "65-85": row(69, 67, 68),
    },
  },
  tv4play: {
    label: "TV4 Play",
    source: `${MB}, Strömningstjänster: Daglig räckvidd, s. 46 ff.`,
    byGroup: {
      "15-24": row(27, 14, 20),
      "25-44": row(25, 18, 21),
      "45-64": row(29, 21, 25),
      "65-85": row(22, 23, 22),
    },
  },
  reklamradio: {
    label: "Reklamradio",
    source: `${MB}, Radiokanaler: Daglig räckvidd, s. 28 ff.`,
    byGroup: {
      "15-24": row(30, 29, 29),
      "25-44": row(35, 31, 33),
      "45-64": row(40, 38, 39),
      "65-85": row(16, 21, 18),
    },
  },
  podd: {
    label: "Podd",
    source: `${MB}, Radio: Daglig räckvidd (podcast/radio i efterhand), s. 22 ff.`,
    note: "Inkluderar Sveriges Radio i efterhand, som inte säljer reklam. Överskattar därför annonsbar poddpublik något.",
    byGroup: {
      "15-24": row(37, 29, 33),
      "25-44": row(40, 45, 42),
      "45-64": row(23, 30, 27),
      "65-85": row(18, 14, 16),
    },
  },
  morgontidning: {
    label: "Morgontidning",
    source: `${MB}, Morgontidning: Daglig räckvidd, s. 54 ff.`,
    byGroup: {
      "15-24": row(21, 25, 23),
      "25-44": row(47, 48, 47),
      "45-64": row(62, 65, 64),
      "65-85": row(76, 82, 79),
    },
  },
  kvallstidning: {
    label: "Kvällstidning",
    source: `${MB}, Kvällstidning: Daglig räckvidd, s. 60 ff.`,
    byGroup: {
      "15-24": row(28, 26, 26),
      "25-44": row(48, 45, 46),
      "45-64": row(48, 56, 52),
      "65-85": row(45, 51, 48),
    },
  },
  tidskrift: {
    label: "Tidskrift",
    source: `${MB}, Tidskrift: Daglig räckvidd, s. 66 ff.`,
    byGroup: {
      "15-24": row(17, 19, 18),
      "25-44": row(25, 27, 26),
      "45-64": row(38, 36, 37),
      "65-85": row(59, 56, 57),
    },
  },
} satisfies Record<string, ReachTable>;

export type ChannelId = keyof typeof MEDIEBAROMETERN_2024;

export const CHANNEL_IDS = Object.keys(MEDIEBAROMETERN_2024) as ChannelId[];

// Sannolikhet (0–1) att en person i cellen använder kanalen en vanlig dag
export function dailyReach(
  channel: ChannelId,
  group: AgeGroup,
  gender: Gender
): number {
  const table: ReachTable = MEDIEBAROMETERN_2024[channel];
  return table.byGroup[group][gender] / 100;
}
