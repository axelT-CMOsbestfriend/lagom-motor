import Anthropic from "@anthropic-ai/sdk";
import { getAnalysis, saveAnalysis } from "../store";
import { askPanel, explainPlans, type BriefContext } from "./explain";
import { requestFromInput, type MediaPlanInput } from "./input";
import { budgetGrid } from "./curve";
import { generatePlans } from "./planner";
import { displayedPanel, toView, type MediaPlanRecord } from "./view";

export function newMediaPlanRecord(input: MediaPlanInput): MediaPlanRecord {
  return {
    status: "running",
    input,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    view: null,
    explanation: null,
    panel: null,
    panelError: null,
    error: null,
  };
}

function message(err: unknown): string {
  if (err instanceof Anthropic.APIConnectionError) {
    return "Kunde inte nå Claude just nu. Försök igen om en stund.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Claude är överbelastad just nu. Försök igen om en stund.";
  }
  return err instanceof Error ? err.message : String(err);
}

// Simuleringen sparas direkt så att siffrorna syns medan Claude motiverar.
// Misslyckas Claude finns planerna kvar. Misslyckas bara panelen finns
// motiveringen kvar.
export async function runMediaPlan(analysisId: string): Promise<void> {
  const record = await getAnalysis(analysisId);
  const mp = record?.mediaPlan;
  if (!record || !mp) return;

  const brief: BriefContext = {
    companyName: record.brief.companyName,
    industry: record.brief.industry,
    goal: record.brief.goal,
  };

  try {
    const request = requestFromInput(mp.input);
    const result = generatePlans(request);
    // Samma förfrågan för flera budgetnivåer, till räckviddskurvan
    const curve = budgetGrid(request.budgetSek).map((budgetSek) =>
      budgetSek === request.budgetSek ? result : generatePlans({ ...request, budgetSek })
    );
    mp.view = toView(result, curve);
    mp.status = "explaining";
    await saveAnalysis(record);

    const explanation = await explainPlans(result, brief);
    mp.explanation = explanation;
    await saveAnalysis(record);

    const recommended = result.plans.find((p) => p.id === explanation.recommendedPlanId)!;
    const channels = recommended.simulation.plan.allocations.map((a) => a.channel);
    try {
      // Panelen svarar bland de 100 personer som visas som prickar
      mp.panel = await askPanel(displayedPanel(result.panel), channels, brief);
    } catch (err) {
      mp.panelError = message(err);
    }
    mp.status = "done";
  } catch (err) {
    mp.status = "error";
    mp.error = message(err);
  }
  mp.finishedAt = new Date().toISOString();
  await saveAnalysis(record);
}
