# Mediaplanen: mål och definition av klar

## Målet

Ett litet svenskt bolag ska kunna mata in sin budget och målgrupp och få en mediaplan där varje krona har ett skäl som går att följa tillbaka till en källa. Innan de lägger pengarna ska en simulering visa ungefär vad planen når.

Modulen är klar när alla punkter i tabellen nedan är gröna. Punkterna är skrivna så att de antingen testas automatiskt (`npm test`) eller har ett manuellt prov med ett tydligt godkäntkrav. Inget "känns klart".

## Vad modulen gör

**In:** briefen från hälsokollet, plus budget, period, målgrupp (ålder, kön, geografi) och mål.

**Ut:** tre alternativa planer, simulerad räckvidd för varje (som spann, inte en exakt siffra), en rekommendation med motivering och en lista över antagandena bakom.

**Hur:**

1. **Syntetisk panel.** Personer dras ur SCB:s befolkning för målgruppen. Deras medievanor dras ur Mediebarometern 2024 per ålder och kön. Claude sätter inga siffror här.
2. **Räckviddsmodell.** Budget och CPM ger antal visningar. Visningarna fördelas över kanalens publik enligt en negativ binomialfördelning (Ehrenbergs NBD). Kanaler som inte kan riktas mot målgruppen får spill.
3. **Planer och resonemang.** Koden tar fram tre planer genom att lägga budgeten i 20 steg, där varje steg hamnar i den kanal som ökar planens mål mest:
   - *Räckvidd först* maximerar andelen som nås minst en gång.
   - *Aktivering* använder bara riktbara kanaler och maximerar exponeringar upp till tre per person. Andelen 3+ fungerar inte som mål, eftersom den gynnar att lägga allt i den minsta och billigaste kanalen.
   - *Luckan* maximerar räckvidd i kanaler där konkurrenterna inte syns.

   Varje siffra i simuleringen blir ett numrerat fakta (`F-rackvidd-facebook` osv.). Claude väljer plan och motiverar med regel-ID ur `lib/media/rules.ts` och fakta-ID. En validerare kontrollerar svaret innan det visas.

## Definition av klar

| # | Krav | Hur det testas | Status |
|---|------|----------------|--------|
| **M1** | **Syntetisk panel** | | |
| 1 | Panelens kanalanvändning ligger inom ±3 procentenheter från Mediebarometern, per kanal, åldersgrupp och kön | Automatiskt, `tests/media/panel.test.ts` | ✅ |
| 2 | Panelens åldersfördelning följer SCB (±2 procentenheter) | Automatiskt | ✅ |
| 3 | Varje siffra har källa med sidnummer, och kvinnor/män stämmer med totalen (fångar avskrivningsfel) | Automatiskt, `tests/media/data.test.ts` | ✅ |
| 4 | Samma seed ger samma panel, så att en körning kan återskapas | Automatiskt | ✅ |
| **M2** | **Räckviddsmodell** | | |
| 5 | Modellen klarar kontrollfallen: noll budget ger noll, avtagande avkastning, taket är kanalens publik, spill i ej riktbara kanaler, överlapp mellan kanaler, ett handräknat fall | Automatiskt, `tests/media/reach.test.ts` | ✅ |
| 6 | Resultatet anges som spann (dyra till billiga CPM:er) och listar alla overifierade antaganden | Automatiskt | ✅ |
| 7 | CPM-intervallen i `lib/media/channels.ts` är kontrollerade mot minst en källa per kanal (Ads Manager-estimat, TV4:s och radiobolagens prislistor), och `verified` är satt till `true` | Manuellt, Axel | ⬜ |
| **M3** | **Planer och resonemang** | | |
| 8 | Koden tar fram tre olika planer för samma budget: räckvidd först, aktivering och luckan konkurrenterna lämnar. Blir två planer identiska markeras det uttryckligen | Automatiskt, `tests/media/planner.test.ts`: budgeten hålls exakt, varje plan är bäst på sitt eget mål, planerna skiljer sig | ✅ |
| 9 | Regelboken finns som data med ID och källa per regel (Binet & Field, Ehrenberg-Bass m.fl.) | Automatiskt, `tests/media/rules.test.ts`: ingen regel utan källa, egna tumregler märkta som heuristik | ✅ |
| 10 | Claude motiverar varje kanalval med minst ett regel-ID och ett fakta-ID. Svar med okända ID:n eller procentsatser som inte finns i de citerade fakta underkänns, skickas tillbaka en gång och ger annars fel | Automatiskt, `tests/media/explain.test.ts` mot sparat svar och falsk klient. **Kvar:** fixturen är handskriven. Kör `npm run mediaplan -- --spela-in` med API-nyckel och se att `npm test` fortfarande går igenom | 🟡 |
| 11 | 5–8 personer ur panelen svarar kvalitativt på var de skulle lägga märke till kampanjen, utan att hitta på nya siffror | Automatiskt: bara kanaler personen använder och som ingår i planen, inga siffror. **Kvar:** manuell granskning av tre riktiga körningar | 🟡 |
| **M4** | **I appen** | | |
| 12 | Mediaplanen har en egen sida, `/analys/[id]/mediaplan`, som nås från ett kort under konkurrentöversikten i hälsokollet. Förutsättningarna (målgrupp gissad ur briefen, affärsmodell, period, budget) bekräftas där. Resultatet visar svaret som en mening, 100 personer ur panelen, tre planer som flikar, ett budgetreglage med räckviddskurva, motiveringen med källor, följdfrågor och ett nästa steg. (Ändrat från "i briefen": fler fält i första formuläret skulle göra vägen till hälsokollet längre för alla.) | Automatiskt i webbläsare, `npm run e2e`: hela flödet, budgetreglaget, flikar, följdfrågor, egen fråga, bokning, omladdning, felvägen och mobil, mot ett låtsas-API för Claude | ✅ |
| 13 | Mediaplanen lägger högst 2 minuter på flödet, från första fältet i formuläret till att planen visas | Händelserna `mediaplan_form_opened`, `mediaplan_started` och `mediaplan_viewed`; `npm run matning` räknar ut medianen. Med låtsas-API:et tar det 5–7 s. **Kvar:** mäta med riktig Claude och riktiga användare | 🟡 |
| **M5** | **Det riktiga provet** | | |
| 14 | Fem riktiga bolag i olika branscher körs igenom. Axel bedömer varje plan från 1 till 5: "skulle jag kunna visa det här för en kund?" | Godkänt: minst fyra av fem får 4 eller högre | ⬜ |
| 15 | Minst ett bolag som redan har kört en kampanj: jämför den simulerade räckvidden med utfallet i Ads Manager | Godkänt: utfallet ligger inom spannet. Om inte: justera k eller CPM och dokumentera varför | ⬜ |

M5 är det som betyder något. Allt ovanför är till för att M5 ska gå att lita på.

## Gränssnittet

Byggt efter prototypen och fyra referenser: budgetreglaget med räckviddskurva (Google Reach Planner), förutsättningar som rader med "Ändra" (Wise), nyckeltal och ett tydligt nästa steg (Duolingo) och följdfrågor under svaret (Perplexity). Andelar skrivs alltid som "X av 100". Kurvan räknas för upp till nio budgetnivåer runt den valda budgeten. Flyttar man reglaget visas simuleringens siffror, och motiveringen kan räknas om för den nya budgeten.

Nya händelser i eventloggen: `mediaplan_budget_explored`, `mediaplan_link_copied` och `mediaplan_booking_clicked`. Bokningen fungerar som lås upp-knapparna i hälsokollet: den mäter intresset men bokar ingenting.

## Så kör du

```bash
npm test           # alla automatiska krav
npm run simulera   # tre handgjorda exempelplaner mot en panel för 25–44 år
npm run mediaplan  # planeraren på exempelbolaget; lägg till -- --claude för Claudes motivering och panelsvar
npm run e2e        # hela flödet i webbläsaren, utan API-nyckel (skärmbilder i e2e/skarmbilder)
npm run matning    # krav 13, ur data/events.json
```

`npm run mediaplan -- --claude` kräver `ANTHROPIC_API_KEY` i `.env.local`.

## Medvetet utanför modulen

- Utomhusreklam. Mediebarometern mäter det inte, och vi har ingen annan källa ännu.
- Sökannonser. Sök fångar efterfrågan som redan finns och passar inte i en räckviddsmodell. Den delen hanteras separat i planen.
- Lokal press och lokalradio. Just nu räknar modellen bara nationellt, med `geoShare` som en förenkling.
- Skrapning av annonsbibliotek (Meta, Tiktok, Google). Det blir nästa modul, som ger signaler om vad konkurrenterna gör.

## Kända svagheter

- Daglig räckvidd används som den publik som går att nå. För kampanjer som pågår i flera veckor underskattar det räckvidden.
- Kanalanvändning antas vara oberoende inom en ålders- och könsgrupp. I verkligheten överlappar till exempel Facebook och Instagram mer än så.
- Poddsiffran innehåller Sveriges Radio i efterhand, som inte säljer reklam.
- Alla CPM:er är overifierade (krav 7). Planerna påverkas direkt: med nuvarande antaganden är Snapchat billigast och dyker upp i alla tre planerna.
- Aktiveringsplanen saknar sök. För ett riktigt småbolag hamnar mycket av aktiveringen i Google Ads, som inte passar räckviddsmodellen. Planen behöver kompletteras med en sökpost som räknas separat.
- Optimeringen är girig och hittar inte garanterat den bästa fördelningen, bara en bra.
- Utan signaler från annonsbiblioteken antas konkurrenterna finnas på Facebook och Instagram (B2C) eller Linkedin och Facebook (B2B). Claude ska säga det, och faktat `F-KONKURRENTER` gör det tydligt.
- Valideringen kontrollerar procentsatser, inte kronbelopp eller påståenden utan siffror.

## Källor

- Mediebarometern 2024, Nordicom, Göteborgs universitet. Sidhänvisning finns per tabell i `lib/media/data/mediebarometern-2024.ts`.
- SCB, folkmängd i femårsklasser efter kön 2025 (Statistikdatabasen sq/171018).
- Ehrenberg, A. (1972). *Repeat-Buying*. Negativ binomialfördelning för exponering.
