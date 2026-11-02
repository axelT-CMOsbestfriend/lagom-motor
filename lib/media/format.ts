// Gemensam formatering för mediaplanen. Siffror visas som "X av 100"
// eftersom det är lättare att ta till sig än procent.

export const kr = (x: number) => `${Math.round(x).toLocaleString("sv-SE")} kr`;

export const of100 = (share: number) => Math.round(share * 100);

export const ore = (sek: number) => `${Math.round(sek * 100)} öre`;

export function listSv(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} och ${items[items.length - 1]}`;
}

export function people(count: number): string {
  if (count >= 1e6) {
    return `${(count / 1e6).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} miljoner`;
  }
  return (Math.round(count / 10_000) * 10_000).toLocaleString("sv-SE");
}

export const times = (x: number) => `${x.toFixed(1).replace(".", ",")} ggr`;
