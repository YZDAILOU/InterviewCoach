import { NextResponse } from "next/server";
import { buildSessionPrompt, buildInterviewQuestions } from "@/lib/interview";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const profile = {
    role: body?.profile?.role ?? "AI Engineer",
    difficulty: body?.profile?.difficulty ?? "standard",
    voiceStyle: body?.profile?.voiceStyle ?? "supportive",
    goal: body?.profile?.goal ?? "Build confidence and answer with structure"
  } as const;

  return NextResponse.json({
    ok: true,
    realtimeReady: false,
    note:
      "This route is ready to be extended into a live session creator once the realtime transport wiring is added.",
    prompt: buildSessionPrompt(profile),
    questions: buildInterviewQuestions(profile),
    transportOptions: ["WebRTC", "WebSocket"]
  });
}
