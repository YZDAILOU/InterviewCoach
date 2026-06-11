export type InterviewProfile = {
  role: string;
  difficulty: "warm-up" | "standard" | "stress-test";
  voiceStyle: "supportive" | "challenging" | "concise";
  goal: string;
};

export type InterviewQuestion = {
  id: number;
  prompt: string;
  whyItMatters: string;
};

export type FeedbackSummary = {
  confidence: number;
  clarity: number;
  structure: number;
  specificity: number;
  fillerWords: number;
  strengths: string[];
  improvements: string[];
  nextDrill: string;
};

export const interviewRoles = [
  "Software Engineer",
  "Data Analyst",
  "Product Manager",
  "Product Designer",
  "Marketing Specialist",
  "Sales Representative",
  "Customer Support",
  "Teacher",
  "Nurse",
  "Healthcare Administrator",
  "Operations Manager",
  "Finance Analyst",
  "HR Specialist",
  "Student",
  "Career Switcher",
  "Interview Practice"
];

export const difficultyLevels = [
  { value: "warm-up", label: "Warm-up" },
  { value: "standard", label: "Standard" },
  { value: "stress-test", label: "Stress test" }
] as const;

export const voiceStyles = [
  { value: "supportive", label: "Supportive" },
  { value: "challenging", label: "Challenging" },
  { value: "concise", label: "Concise" }
] as const;

export function buildInterviewQuestions(profile: InterviewProfile): InterviewQuestion[] {
  const role = profile.role || "your target role";
  const base = [
    {
      prompt: `Walk me through a recent experience where you made a measurable impact in your ${role} role.`,
      whyItMatters: "Lets the agent test structure, ownership, and outcome framing."
    },
    {
      prompt: `Tell me about a time you had to work through a disagreement with a teammate, colleague, client, or stakeholder.`,
      whyItMatters: "Shows interpersonal judgment and conflict resolution."
    },
    {
      prompt: `Explain something you had to learn quickly and then communicate clearly to someone else.`,
      whyItMatters: "Reveals how well the candidate explains complex ideas."
    },
    {
      prompt: `What would you improve if you had 30 more days on one of your most important projects or responsibilities?`,
      whyItMatters: "Tests judgment, reflection, and growth mindset."
    }
  ];

  if (profile.difficulty === "stress-test") {
    base.unshift({
      prompt: `You have 90 seconds. Why should we trust you to own this role from day one?`,
      whyItMatters: "Creates pressure and exposes confidence under constraint."
    });
  }

  if (profile.voiceStyle === "supportive") {
    base.push({
      prompt: `Take a breath, then summarize the strongest part of your answer in one sentence.`,
      whyItMatters: "Encourages the kind of reflection that helps students build confidence."
    });
  }

  return base.map((item, index) => ({
    id: index + 1,
    ...item
  }));
}

export function buildMockFeedback(transcript: string, profile: InterviewProfile): FeedbackSummary {
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  const hasExamples = /(example|project|result|built|led|shipped|improved)/i.test(transcript);
  const hasStructure = /(first|second|finally|because|so that|therefore)/i.test(transcript);
  const hasConfidenceMarkers = /(i can|i did|i led|i owned|i solved)/i.test(transcript);
  const fillerMatches = transcript.match(/\b(um+|uh+|like|you know)\b/gi)?.length ?? 0;

  const confidenceBase = profile.difficulty === "stress-test" ? 66 : profile.difficulty === "standard" ? 74 : 80;
  const confidence = clamp(confidenceBase + (hasConfidenceMarkers ? 8 : -4) + (words > 120 ? 6 : 0));
  const clarity = clamp(70 + (hasStructure ? 12 : -8) + (words > 90 ? 4 : -4));
  const structure = clamp(68 + (hasStructure ? 15 : -10));
  const specificity = clamp(64 + (hasExamples ? 18 : -6) + (words > 140 ? 5 : 0));
  const fillerWords = clamp(100 - fillerMatches * 14);

  const strengths = [
    hasConfidenceMarkers ? "You used ownership language." : "You stayed engaged and thoughtful.",
    hasStructure ? "Your answer had a clear sequence." : "You were concise enough to keep the answer moving.",
    hasExamples ? "You referenced a concrete example." : "You showed a good foundation to build on."
  ];

  const improvements = [
    hasExamples ? "Add one more metric or result to make the impact feel sharper." : "Add a concrete result or metric to ground your answer.",
    hasStructure ? "Keep the same structure, but trim the middle 20%." : "Use a simple framework like Situation, Action, Result.",
    fillerMatches > 2 ? "Slow down slightly and replace filler words with short pauses." : "Pause intentionally before your key point."
  ];

  return {
    confidence,
    clarity,
    structure,
    specificity,
    fillerWords,
    strengths,
    improvements,
    nextDrill:
      profile.voiceStyle === "challenging"
        ? "Retry the same question with a 45-second time limit."
        : "Replay the answer and tighten the opening into a single thesis sentence."
  };
}

export function buildSessionPrompt(profile: InterviewProfile): string {
  const questionTone =
    profile.voiceStyle === "challenging"
      ? "Push for sharper examples, shorter answers, and direct follow-up questions."
      : profile.voiceStyle === "concise"
        ? "Keep prompts crisp, time-boxed, and focused on one evaluation objective at a time."
        : "Encourage confidence, keep the user calm, and nudge them toward stronger examples.";

  return [
    "You are a voice interview coach for people preparing for interviews across technical, business, creative, healthcare, education, operations, and service roles.",
    `Role focus: ${profile.role}.`,
    `Difficulty: ${profile.difficulty}.`,
    `Coach style: ${profile.voiceStyle}.`,
    `Goal: ${profile.goal}.`,
    questionTone,
    "Ask one question at a time.",
    "If the user freezes, offer a gentle hint, not the answer.",
    "After each answer, give one actionable improvement and one thing they did well."
  ].join(" ");
}

export function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
