import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildMockFeedback, buildSessionPrompt, type InterviewProfile } from "@/lib/interview";

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    confidence: { type: "integer" },
    clarity: { type: "integer" },
    structure: { type: "integer" },
    specificity: { type: "integer" },
    fillerWords: { type: "integer" },
    strengths: {
      type: "array",
      items: { type: "string" }
    },
    improvements: {
      type: "array",
      items: { type: "string" }
    },
    nextDrill: { type: "string" }
  },
  required: [
    "confidence",
    "clarity",
    "structure",
    "specificity",
    "fillerWords",
    "strengths",
    "improvements",
    "nextDrill"
  ]
} as const;

export async function POST(request: Request) {
  const body = await request.json();
  const transcript = String(body?.transcript ?? "");
  const question = String(body?.question ?? "");
  const profile = {
    role: body?.profile?.role ?? "AI Engineer",
    difficulty: body?.profile?.difficulty ?? "standard",
    voiceStyle: body?.profile?.voiceStyle ?? "supportive",
    goal: body?.profile?.goal ?? "Build confidence and answer with structure"
  } satisfies InterviewProfile;

  const fallback = buildMockFeedback(transcript, profile);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      feedback: fallback,
      source: "mock"
    });
  }

  try {
    const client = new OpenAI({ apiKey });
    const result = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      input: [
        "You are a supportive but precise interview coach.",
        buildSessionPrompt(profile),
        `Question: ${question}`,
        `Transcript: ${transcript}`,
        "Return a concise evaluation that scores confidence, clarity, structure, specificity, and filler words from 0 to 100.",
        "Be specific, practical, and encouraging."
      ].join("\n\n"),
      text: {
        format: {
          type: "json_schema",
          name: "InterviewFeedback",
          strict: true,
          schema: feedbackSchema
        }
      }
    });

    const content = result.output_text?.trim();

    if (!content) {
      return NextResponse.json({
        feedback: fallback,
        source: "mock-fallback"
      });
    }

    const parsed = JSON.parse(content) as typeof fallback;

    return NextResponse.json({
      feedback: parsed,
      source: "openai"
    });
  } catch (error) {
    return NextResponse.json({
      feedback: fallback,
      source: "mock-error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
