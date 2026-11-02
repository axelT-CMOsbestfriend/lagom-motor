import { after } from "next/server";
import { jobToken, runAnalysisStep } from "@/lib/pipeline";

// Internt: startar hälsokollets steg 2 i ett eget serveranrop, med egen
// tidsgräns. Anropas bara av steg 1, som skickar jobbtoken i en header.
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (request.headers.get("x-job-token") !== jobToken()) {
    return Response.json({ error: "Ej behörig" }, { status: 401 });
  }
  const { id } = await params;
  after(() =>
    runAnalysisStep(id).catch((err) => console.error(`Analyssteg ${id} kraschade:`, err))
  );
  return Response.json({ started: true }, { status: 202 });
}
