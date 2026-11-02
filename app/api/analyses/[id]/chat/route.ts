import { CHAT_FREE_QUESTION_LIMIT, chatWithCmo } from "@/lib/claude";
import { getAnalysis, logEvent } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getAnalysis(id);
  if (!record || record.status !== "done") {
    return Response.json(
      { error: "Analysen är inte klar än" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const messages: { role: "user" | "assistant"; content: string }[] =
    Array.isArray(body?.messages) ? body.messages : [];
  const userQuestions = messages.filter((m) => m.role === "user").length;

  if (userQuestions === 0) {
    return Response.json({ error: "Ingen fråga skickades" }, { status: 400 });
  }
  if (userQuestions > CHAT_FREE_QUESTION_LIMIT) {
    return Response.json(
      {
        error: "free_limit_reached",
        message:
          "Du har använt dina 3 kostnadsfria frågor. Med Pro får du obegränsat bollplank med din AI-marknadschef.",
      },
      { status: 403 }
    );
  }

  try {
    const reply = await chatWithCmo(record, messages);
    await logEvent("chat_question_asked", id);
    return Response.json({
      reply,
      questionsLeft: CHAT_FREE_QUESTION_LIMIT - userQuestions,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Okänt fel" },
      { status: 500 }
    );
  }
}
