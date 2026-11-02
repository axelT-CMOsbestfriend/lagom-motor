import { after } from "next/server";
import { getAnalysis, logEvent, saveAnalysis } from "@/lib/store";
import { parseMediaPlanInput } from "@/lib/media/input";
import { newMediaPlanRecord, runMediaPlan } from "@/lib/media/run";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getAnalysis(id);
  if (!record || record.status !== "done") {
    return Response.json(
      { error: "Hälsokollet måste vara klart först" },
      { status: 404 }
    );
  }
  const current = record.mediaPlan?.status;
  if (current === "running" || current === "explaining") {
    return Response.json(
      { error: "Mediaplanen håller redan på att tas fram" },
      { status: 409 }
    );
  }

  const parsed = parseMediaPlanInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  record.mediaPlan = newMediaPlanRecord(parsed.input);
  await saveAnalysis(record);
  await logEvent("mediaplan_started", id);

  after(() =>
    runMediaPlan(id).catch((err) =>
      console.error(`Mediaplan ${id} kraschade:`, err)
    )
  );

  return Response.json({ mediaPlan: record.mediaPlan }, { status: 202 });
}
