import type { CrawlResult, CrawledPage } from "../types";

// Teknisk on-page-audit. Bara fasta regler och ingen AI, så samma sajt
// ger alltid samma svar och det kostar ingenting att köra.

export type Severity = "hög" | "medel" | "låg";

export interface SeoIssue {
  rule: string;
  severity: Severity;
  page: string;
  detail: string;
  fix: string;
  effortHours: number;
}

export interface OnPageResult {
  score: number;
  pagesChecked: number;
  issues: SeoIssue[];
}

const PENALTY: Record<Severity, number> = { hög: 12, medel: 5, låg: 2 };

type Rule = Omit<SeoIssue, "page">;

function pageRules(page: CrawledPage, isHome: boolean): Rule[] {
  const out: Rule[] = [];
  const add = (r: Rule) => out.push(r);
  const title = page.title ?? "";

  if (!title) {
    add({ rule: "titel-saknas", severity: "hög", detail: "Sidan har ingen <title>.", fix: "Skriv en titel på 30–60 tecken med sidans viktigaste sökord först.", effortHours: 0.25 });
  } else if (title.length > 60) {
    add({ rule: "titel-for-lang", severity: "låg", detail: `Titeln är ${title.length} tecken och klipps i Google.`, fix: "Korta titeln till högst 60 tecken.", effortHours: 0.25 });
  } else if (title.length < 20) {
    add({ rule: "titel-for-kort", severity: "medel", detail: `Titeln "${title}" är bara ${title.length} tecken.`, fix: "Bygg ut titeln med vad ni erbjuder och var.", effortHours: 0.25 });
  }

  const meta = page.metaDescription ?? "";
  if (!meta) {
    add({ rule: "meta-saknas", severity: "medel", detail: "Metabeskrivning saknas, så Google väljer en egen text.", fix: "Skriv en metabeskrivning på 120–160 tecken som säger varför man ska klicka.", effortHours: 0.25 });
  } else if (meta.length > 160) {
    add({ rule: "meta-for-lang", severity: "låg", detail: `Metabeskrivningen är ${meta.length} tecken.`, fix: "Korta den till högst 160 tecken.", effortHours: 0.25 });
  }

  if (page.h1.length === 0) {
    add({ rule: "h1-saknas", severity: "hög", detail: "Sidan saknar H1-rubrik.", fix: "Lägg till en H1 som säger vad sidan handlar om.", effortHours: 0.25 });
  } else if (page.h1.length > 1) {
    add({ rule: "flera-h1", severity: "låg", detail: `Sidan har ${page.h1.length} H1-rubriker.`, fix: "Behåll en H1 och gör resten till H2.", effortHours: 0.25 });
  }

  if (page.wordCount < 250) {
    add({ rule: "tunt-innehall", severity: "medel", detail: `Sidan har bara ${page.wordCount} ord.`, fix: "Bygg ut texten till minst 300 ord som svarar på kundens frågor.", effortHours: 2 });
  }
  if (!page.hasViewportMeta) {
    add({ rule: "viewport-saknas", severity: "hög", detail: "Viewport-tagg saknas, så sidan visas fel i mobilen.", fix: 'Lägg till <meta name="viewport" content="width=device-width, initial-scale=1">.', effortHours: 0.25 });
  }
  if (page.canonical === null) {
    add({ rule: "canonical-saknas", severity: "låg", detail: "Canonical-länk saknas.", fix: "Lägg till <link rel=\"canonical\"> som pekar på sidans egen adress.", effortHours: 0.5 });
  }
  if (page.metaRobots?.includes("noindex")) {
    add({ rule: "noindex", severity: "hög", detail: "Sidan ber Google att inte indexera den (noindex).", fix: "Ta bort noindex om sidan ska synas i sökresultaten.", effortHours: 0.25 });
  }
  if ((page.imagesWithoutAlt ?? 0) > 0) {
    add({ rule: "bilder-utan-alt", severity: "låg", detail: `${page.imagesWithoutAlt} av ${page.imageCount} bilder saknar alt-text.`, fix: "Beskriv varje bild kort i alt-texten.", effortHours: 0.5 });
  }

  if (isHome) {
    if (page.schemaTypes && page.schemaTypes.length === 0) {
      add({ rule: "schema-saknas", severity: "medel", detail: "Startsidan har ingen strukturerad data (JSON-LD).", fix: "Lägg till schema för Organization eller LocalBusiness med namn, adress och kontakt.", effortHours: 1 });
    }
    if (page.ogImage === null) {
      add({ rule: "og-bild-saknas", severity: "låg", detail: "Ingen og:image, så delningar i sociala medier saknar bild.", fix: "Lägg till en og:image på 1200×630 px.", effortHours: 0.5 });
    }
    if (page.lang === null) {
      add({ rule: "lang-saknas", severity: "låg", detail: "<html> saknar lang-attribut.", fix: 'Sätt <html lang="sv">.', effortHours: 0.1 });
    }
  }
  return out;
}

export function auditOnPage(crawl: CrawlResult): OnPageResult {
  const issues: SeoIssue[] = [];
  crawl.pages.forEach((page, i) => {
    for (const rule of pageRules(page, i === 0)) issues.push({ ...rule, page: page.url });
  });

  const byTitle = new Map<string, string[]>();
  for (const page of crawl.pages) {
    if (!page.title) continue;
    byTitle.set(page.title, [...(byTitle.get(page.title) ?? []), page.url]);
  }
  for (const [title, urls] of byTitle) {
    if (urls.length < 2) continue;
    issues.push({
      rule: "dubblett-titel",
      severity: "medel",
      page: urls.join(", "),
      detail: `${urls.length} sidor har samma titel "${title}".`,
      fix: "Ge varje sida en egen titel som beskriver just den sidan.",
      effortHours: 0.5,
    });
  }

  if (!crawl.foundSitemap) {
    issues.push({
      rule: "sitemap-saknas",
      severity: "medel",
      page: crawl.baseUrl,
      detail: "Ingen sitemap.xml hittades.",
      fix: "Skapa en sitemap.xml och anmäl den i Google Search Console.",
      effortHours: 0.5,
    });
  }

  const penalty = issues.reduce((sum, i) => sum + PENALTY[i.severity], 0);
  return { score: Math.max(0, 100 - penalty), pagesChecked: crawl.pages.length, issues };
}
