import { getAnalysis } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getAnalysis(id);
  if (!record) {
    return Response.json({ error: "Analysen hittades inte" }, { status: 404 });
  }
  return Response.json(record);
}
