import Anthropic from "@anthropic-ai/sdk";

// Det kunden ser när något går fel. Råa felkoder från Anthropic eller Google
// säger inget för en kund och kan läcka detaljer, så de loggas på servern och
// ersätts med en kort svensk text. Våra egna meddelanden är redan på svenska
// och skickas vidare som de är.
export function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.APIConnectionError) return "Kunde inte nå AI-tjänsten just nu.";
  if (err instanceof Anthropic.APIError) {
    if (err.status === 429 || err.status === 529) return "AI-tjänsten är överbelastad just nu.";
    return "Tjänsten är tillfälligt otillgänglig hos oss.";
  }
  const message = err instanceof Error ? err.message : String(err);
  if (message.startsWith("PageSpeed svarade 429")) return "Googles PageSpeed har nått sin dagskvot.";
  if (message.startsWith("PageSpeed svarade")) return "Googles PageSpeed svarade inte.";
  if (/^(Kunde inte|Ogiltig|Hälsokollet|Mediaplanen|Budgeten|Perioden|Åldern|Välj|Jobbet)/.test(message)) return message;
  return "Något gick fel i analysen.";
}
