import { generateFollowUpQuestions } from "@/lib/claude";

export async function POST(request: Request) {
  const body = await request.json();
  const { companyName, websiteUrl, industry, goal } = body ?? {};
  if (!companyName || !websiteUrl || !goal) {
    return Response.json(
      { error: "Företagsnamn, webbplats och mål krävs" },
      { status: 400 }
    );
  }
  try {
    const questions = await generateFollowUpQuestions({
      companyName,
      websiteUrl,
      industry: industry ?? "",
      goal,
    });
    return Response.json({ questions });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Okänt fel" },
      { status: 500 }
    );
  }
}
