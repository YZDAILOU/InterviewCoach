import { NextResponse } from "next/server";
import { buildSessionPrompt, type InterviewProfile } from "@/lib/interview";

type SessionRequest = {
  profile?: Partial<InterviewProfile>;
  goal?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SessionRequest;
  const profile: InterviewProfile = {
    role: body.profile?.role ?? "AI Engineer",
    difficulty: body.profile?.difficulty ?? "standard",
    voiceStyle: body.profile?.voiceStyle ?? "supportive",
    goal: body.goal ?? body.profile?.goal ?? "Build confidence and answer with structure"
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        clientSecret: "",
        model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2",
        prompt: buildSessionPrompt(profile),
        mock: true,
        error: "OPENAI_API_KEY is not set on the server."
      },
      { status: 200 }
    );
  }

  const model = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2";

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          instructions: buildSessionPrompt(profile),
          audio: {
            input: {
              turn_detection: {
                type: "server_vad"
              }
            },
            output: {
              voice: "alloy"
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          clientSecret: "",
          model,
          prompt: buildSessionPrompt(profile),
          mock: true,
          error: errorText
        },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      value?: string;
      client_secret?: { value?: string };
      client_secret_value?: string;
      clientSecret?: string;
    };

    const clientSecret =
      data.value ?? data.client_secret?.value ?? data.client_secret_value ?? data.clientSecret ?? "";

    return NextResponse.json({
      clientSecret,
      model,
      prompt: buildSessionPrompt(profile),
      mock: false
    });
  } catch (error) {
    return NextResponse.json(
      {
        clientSecret: "",
        model,
        prompt: buildSessionPrompt(profile),
        mock: true,
        error: error instanceof Error ? error.message : "Unable to mint realtime session"
      },
      { status: 500 }
    );
  }
}
