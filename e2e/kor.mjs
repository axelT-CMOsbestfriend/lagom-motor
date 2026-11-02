// npm run e2e
// Kör hela flödet i en riktig webbläsare: brief → hälsokoll → mediaplanssidan,
// plus felvägen när Claude inte svarar. Claude ersätts av ett låtsas-API
// (e2e/mock-claude.mjs) och webbplatsen av e2e/site, så inget går ut på nätet.
// Kräver en Chromium för Playwright (npx playwright install chromium).
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { startMockClaude } from "./mock-claude.mjs";

const APP = 3100;
const MOCK = 4200;
const SITE = 4100;
const SHOTS = new URL("./skarmbilder/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

function startSite() {
  const server = http.createServer(async (req, res) => {
    const file = req.url === "/" ? "index.html" : req.url.slice(1);
    try {
      const html = await readFile(new URL(`./site/${file}`, import.meta.url));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(SITE, () => resolve(server)));
}

async function waitFor(url, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // servern har inte startat än
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${url} svarade inte inom ${timeoutMs / 1000} s`);
}

const site = await startSite();
let mock = await startMockClaude(MOCK);
const app = spawn("npx", ["next", "dev", "-p", String(APP)], {
  env: {
    ...process.env,
    ANTHROPIC_API_KEY: "e2e",
    ANTHROPIC_BASE_URL: `http://localhost:${MOCK}`,
    NO_PROXY: "localhost,127.0.0.1",
    no_proxy: "localhost,127.0.0.1",
  },
  stdio: "ignore",
  detached: true,
});

let failed = false;
const browser = await chromium.launch();
try {
  await waitFor(`http://localhost:${APP}/`, 120_000);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  // Brief och hälsokoll. Åldern i svaret ska ge en gissad målgrupp.
  await page.goto(`http://localhost:${APP}/`);
  await page.getByPlaceholder("t.ex. Bergs Rör AB").fill("Exempelbolaget");
  await page.getByPlaceholder("t.ex. bergsror.se").fill(`http://localhost:${SITE}`);
  await page.getByPlaceholder("t.ex. VVS och rörmokeri i Uppsala").fill("Kafé och bageri");
  await page.locator("textarea").first().fill("Fler kunder till nya caféet i centrum");
  await page.getByRole("button", { name: /Fortsätt/ }).click();
  await page.getByText("Några följdfrågor").waitFor({ timeout: 60_000 });
  await page.locator("form textarea").first().fill("Folk som jobbar i centrum, 25–44 år");
  await page.getByRole("button", { name: /Starta mitt Marknadshälsokoll/ }).click();
  await page.getByRole("link", { name: /Ta fram din mediaplan/ }).click({ timeout: 90_000 });
  console.log("✓ hälsokollet leder vidare till mediaplanen");

  // Förutsättningar: målgruppen är gissad ur briefen, budgeten sätts till 200 000 kr
  await page.getByText("Gissat utifrån din brief. Stämmer det?").waitFor({ timeout: 30_000 });
  await page.getByText("25–44 år, kvinnor och män").waitFor();
  await page.getByRole("button", { name: "Ja", exact: true }).click();
  await page.locator("#mp-budget").fill("9");
  await page.getByText("200 000 kr", { exact: true }).waitFor();
  await page.screenshot({ path: `${SHOTS}1-forutsattningar.png` });
  console.log("✓ målgruppen gissas ur briefen");

  const started = Date.now();
  await page.getByRole("button", { name: "Ta fram min mediaplan" }).click();
  await page.getByText("Varför inte de andra?").waitFor({ timeout: 90_000 });
  await page.getByText("Har berättat hur de reagerar").waitFor({ timeout: 30_000 });
  console.log(`✓ planen, motiveringen och panelen visas efter ${((Date.now() - started) / 1000).toFixed(1)} s`);
  await page.getByRole("heading", { name: "Lägg pengarna på Facebook och Instagram" }).waitFor();
  await page.screenshot({ path: `${SHOTS}2-mediaplan.png`, fullPage: true });

  // Budgetreglaget: en annan nivå ger nya siffror och erbjuder omräkning
  const reachBefore = await page.locator("[role=tab][aria-selected=true]").innerText();
  await page.locator("#mp-curve-budget").fill("0");
  await page.getByRole("button", { name: /Räkna om med/ }).waitFor();
  const reachAfter = await page.locator("[role=tab][aria-selected=true]").innerText();
  if (reachBefore === reachAfter) throw new Error("siffrorna ändrades inte med budgeten");
  await page.locator("#mp-curve-budget").fill(String(await page.locator("#mp-curve-budget").getAttribute("max")));
  console.log("✓ budgetreglaget räknar om siffrorna");

  // Flikar och prickar
  await page.getByRole("tab", { name: /Sälj nu/ }).click();
  await page.getByRole("tab", { name: /Nå flest/ }).click();
  await page.locator("[aria-label*='nås inte']").first().click();
  await page.getByText(/nås inte med den här budgeten|Finns inte i planens kanaler/).first().waitFor();
  console.log("✓ flikar och personkort fungerar");

  // Följdfrågor och egen fråga
  await page.getByRole("button", { name: "Varför inte Tiktok?" }).click();
  await page.getByText(/Bara 13 av 100 i din målgrupp använder Tiktok/).waitFor();
  await page.locator("#mp-ask").fill("Hur länge ska jag köra?");
  await page.getByRole("button", { name: "Fråga", exact: true }).click();
  await page.getByText("Kör planen i åtta veckor").waitFor({ timeout: 30_000 });
  console.log("✓ följdfrågor och egen fråga (chatten känner till mediaplanen)");

  // Nästa steg
  await page.getByRole("button", { name: "Boka genomgång" }).click();
  await page.getByText("Tack för intresset!").waitFor();
  console.log("✓ bokningen registreras");

  await page.reload();
  await page.getByText("Varför inte de andra?").waitFor({ timeout: 30_000 });
  await page.getByRole("link", { name: /Tillbaka till hälsokollet/ }).click();
  await page.getByRole("link", { name: /Öppna mediaplanen/ }).click({ timeout: 30_000 });
  await page.getByText("Varför inte de andra?").waitFor({ timeout: 30_000 });
  console.log("✓ planen finns kvar och nås från rapportsidan");

  // Felvägen: Claude svarar inte, siffrorna ska ändå synas
  await new Promise((r) => mock.close(r));
  mock = null;
  await page.getByRole("button", { name: "Ändra" }).first().click();
  await page.getByRole("button", { name: "Ta fram min mediaplan" }).click();
  await page.getByText("Kunde inte nå Claude").waitFor({ timeout: 120_000 });
  const tabs = await page.locator("[role=tab]").count();
  if (tabs !== 3) throw new Error(`förväntade 3 planer vid fel, såg ${tabs}`);
  await page.screenshot({ path: `${SHOTS}3-fel.png` });
  console.log("✓ vid fel visas planerna och ett begripligt felmeddelande");

  // Mobil
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  if (width > 390) throw new Error(`sidan scrollar i sidled på mobil (${width}px)`);
  await page.screenshot({ path: `${SHOTS}4-mobil.png`, fullPage: true });
  console.log("✓ ingen sidscroll på mobil");

  if (pageErrors.length > 0) throw new Error(`fel i webbläsaren: ${pageErrors.join("; ")}`);
  console.log(`\nKlart. Skärmbilder i ${SHOTS}`);
} catch (err) {
  failed = true;
  console.error(`✗ ${err.message}`);
} finally {
  await browser.close();
  mock?.close();
  site.close();
  try {
    process.kill(-app.pid);
  } catch {
    // redan avslutad
  }
}
process.exit(failed ? 1 : 0);
