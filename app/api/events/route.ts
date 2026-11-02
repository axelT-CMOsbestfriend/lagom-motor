import { logEvent } from "@/lib/store";
import type { EventName } from "@/lib/types";

const VALID_EVENTS: EventName[] = [
  "brief_started",
  "brief_completed",
  "healthcheck_viewed",
  "chat_question_asked",
  "unlock_clicked",
  "mediaplan_form_opened",
  "mediaplan_viewed",
  "mediaplan_budget_explored",
  "mediaplan_link_copied",
  "mediaplan_booking_clicked",
];

export async function POST(request: Request) {
  const body = await request.json();
  const name = body?.name as EventName;
  if (!VALID_EVENTS.includes(name)) {
    return Response.json({ error: "Ogiltigt event" }, { status: 400 });
  }
  const detail =
    typeof body?.detail === "string" ? body.detail.slice(0, 60) : undefined;
  await logEvent(name, body?.analysisId ?? null, detail);
  return Response.json({ ok: true });
}
