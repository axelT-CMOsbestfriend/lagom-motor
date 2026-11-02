import type { MediaPlanRecord } from "./media/view";

export interface FollowUpQA {
  question: string;
  answer: string;
}

export interface Brief {
  companyName: string;
  websiteUrl: string;
  industry: string;
  goal: string;
  followUps: FollowUpQA[];
}

export interface CrawledPage {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  textExcerpt: string;
  wordCount: number;
  hasViewportMeta: boolean;
  // SEO-fälten saknas i analyser som crawlades innan SEO-auditen fanns
  lang?: string | null;
  canonical?: string | null;
  metaRobots?: string | null;
  imageCount?: number;
  imagesWithoutAlt?: number;
  schemaTypes?: string[];
  ogImage?: string | null;
}

export interface CrawlResult {
  baseUrl: string;
  pages: CrawledPage[];
  socialLinks: string[];
  foundSitemap: boolean;
  errors: string[];
}

export interface Strength {
  title: string;
  detail: string;
  source: string;
}

export interface Gap {
  title: string;
  detail: string;
  why: string;
  source: string;
}

export interface CompetitorOverview {
  name: string;
  url: string;
  overview: string;
  theirEdge: string;
  yourOpening: string;
}

export interface PlanItem {
  heading: string;
  detail: string;
  why: string;
}

export interface PlanPhase {
  period: "30" | "60" | "90";
  items: PlanItem[];
}

// Steg 1 av hälsokollet: konkurrenter hittade med webbsökning
export interface CompetitorResearch {
  competitors: { name: string; url: string; notes: string }[];
}

export interface HealthCheck {
  summary: string;
  strengths: Strength[];
  gaps: Gap[];
  competitors: CompetitorOverview[];
  plan: PlanPhase[];
}

export type AnalysisStatus =
  | "pending"
  | "crawling"
  | "analyzing"
  | "done"
  | "error";

export interface AnalysisRecord {
  id: string;
  createdAt: string;
  status: AnalysisStatus;
  statusMessage: string;
  brief: Brief;
  crawl: CrawlResult | null;
  // Saknas i analyser som gjordes innan hälsokollet delades i två steg
  research?: CompetitorResearch | null;
  healthCheck: HealthCheck | null;
  error: string | null;
  // Saknas i analyser som skapades innan mediaplanen fanns
  mediaPlan?: MediaPlanRecord | null;
}

export type EventName =
  | "brief_started"
  | "brief_completed"
  | "healthcheck_viewed"
  | "chat_question_asked"
  | "unlock_clicked"
  | "mediaplan_form_opened"
  | "mediaplan_started"
  | "mediaplan_viewed"
  | "mediaplan_budget_explored"
  | "mediaplan_link_copied"
  | "mediaplan_booking_clicked";

export interface LoggedEvent {
  name: EventName;
  analysisId: string | null;
  timestamp: string;
  // För unlock_clicked: vilken prisnivå i value ladder som klickades
  // (t.ex. "report_249", "bump_349", "downsell_99", "pro_399")
  detail?: string;
}
