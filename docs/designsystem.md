# Designsystem – Marknadspiloten

Marknadspiloten är tänkt som en **subdomän till axeltuvemo.com** och delar därför
samma brand book. Tokens nedan är extraherade direkt från axeltuvemo.com så att
appen känns som samma varumärke. Använd dem i all ny UI.

## Färger (CSS-variabler i `app/globals.css`)

| Token | Värde | Användning |
|---|---|---|
| `--color-background` | `#F9F7EE` | Sidbakgrund (varm cream) |
| `--color-surface` | `#FFFFFF` | Kort, paneler |
| `--color-foreground` / `--color-primary` | `#0F0D0B` | Rubriker, primär text, **knappar** (nästan svart) |
| `--color-on-primary` | `#F9F7EE` | Cream text på mörka knappar |
| `--color-secondary` | `#423C37` | Brödtext (varm mörk) |
| `--color-muted` | `#F0EBDC` | Parchment-ton: ikon-badges, subtila fyllnader |
| `--color-muted-foreground` | `#7A7167` | Hjälptext |
| `--color-border` | `#E7E1D2` | Kantlinjer (varm ljus) |
| `--color-accent` | `#0F0D0B` | Funktionell accent = nästan svart (länkar, fokus, CTA) |
| `--color-highlight` | `#FED835` | Varumärkets guld – **endast dekorativ** (statusprick, "Byggd"-badge). Aldrig som textfärg/knappfyllnad (dålig kontrast på cream) |
| success `#3F7A4B`, destructive `#B4341F` | | Semantiska statusfärger |

## Typografi

- **Rubriker (h1–h3):** Cormorant Garamond (serif, vikt 500) – samma som axeltuvemo.com.
- **Brödtext/UI:** Karla (300–700) – samma som axeltuvemo.com.
- Laddas via `next/font/google` i `app/layout.tsx` (`--font-cormorant` / `--font-karla`).

## Knappar (matchar axeltuvemo.com)

- Primär CTA: bakgrund `--color-primary` (#0F0D0B), text `--color-on-primary` (cream), `rounded-lg` (8px), Karla 500.
- Sekundär: nästan svart kantlinje + nästan svart text på cream, hover `--color-muted`.

## Ikoner

- **lucide-react** genomgående, stroke ~1.75 – aldrig emoji som strukturell ikon.

## Rörelse

- `.animate-rise`: mjuk fade + translateY vid inträde. Respekterar `prefers-reduced-motion`.
- Fokusring (`:focus-visible`) på `--color-ring` (nästan svart).

## Regel för ny sida/komponent

1. Använd tokens ovan – inga hårdkodade sky/indigo/slate/blue-klasser.
2. Guld (`--color-highlight`) bara som liten dekorativ highlight, aldrig text på cream.
3. Ikoner från lucide-react.
