// Andel av Sveriges befolkning per län, avrundat. Bygger på SCB:s
// folkmängd per län 2024, men siffrorna är avrundade och ska stämmas av
// mot Statistikdatabasen innan de räknas som verifierade.
export const SCB_LAN_SOURCE = "SCB, Folkmängd per län 2024 (avrundat, ska verifieras)";

export const LAN_SHARE: Record<string, { label: string; share: number }> = {
  stockholm: { label: "Stockholms län", share: 0.232 },
  uppsala: { label: "Uppsala län", share: 0.038 },
  sodermanland: { label: "Södermanlands län", share: 0.029 },
  ostergotland: { label: "Östergötlands län", share: 0.045 },
  jonkoping: { label: "Jönköpings län", share: 0.035 },
  kronoberg: { label: "Kronobergs län", share: 0.019 },
  kalmar: { label: "Kalmar län", share: 0.023 },
  gotland: { label: "Gotlands län", share: 0.006 },
  blekinge: { label: "Blekinge län", share: 0.015 },
  skane: { label: "Skåne län", share: 0.135 },
  halland: { label: "Hallands län", share: 0.032 },
  vastragotaland: { label: "Västra Götalands län", share: 0.17 },
  varmland: { label: "Värmlands län", share: 0.027 },
  orebro: { label: "Örebro län", share: 0.029 },
  vastmanland: { label: "Västmanlands län", share: 0.027 },
  dalarna: { label: "Dalarnas län", share: 0.027 },
  gavleborg: { label: "Gävleborgs län", share: 0.027 },
  vasternorrland: { label: "Västernorrlands län", share: 0.023 },
  jamtland: { label: "Jämtlands län", share: 0.0125 },
  vasterbotten: { label: "Västerbottens län", share: 0.026 },
  norrbotten: { label: "Norrbottens län", share: 0.024 },
};
