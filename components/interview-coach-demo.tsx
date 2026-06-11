"use client";

import { RealtimeVoiceStudio } from "@/components/realtime-voice-studio";

export function InterviewCoachDemo() {
  return (
    <main className="page">
      <div className="shell">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark">V</div>
            <div>
              <div className="brand-title">Voice Interview Coach</div>
              <div className="brand-subtitle">A voice-only mock interview with post-call feedback</div>
            </div>
          </div>
          <div className="pill">Voice-first interview flow • Feedback after the call</div>
        </div>

        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">Practice like a real interview</div>
            <h1 className="headline">
              Speak your answers, then get reviewed <span>after the interview ends</span>.
            </h1>
            <p className="lede">
              This version keeps the experience focused on one thing: a natural voice conversation with an
              interviewer. It is designed for people across domains, from students and career switchers to
              healthcare, business, education, operations, and creative roles. When you end the call, the
              app turns the full session into a structured review so you can see what landed well and what
              to improve next.
            </p>

            <div className="stats-row">
              <div className="stat">
                <div className="stat-value">Voice</div>
                <div className="stat-label">No typing, just speaking</div>
              </div>
              <div className="stat">
                <div className="stat-value">Live</div>
                <div className="stat-label">Browser mic and realtime audio</div>
              </div>
              <div className="stat">
                <div className="stat-value">Review</div>
                <div className="stat-label">Feedback after the interview ends</div>
              </div>
            </div>
          </div>

          <div className="hero-panel">
            <div className="panel-grid">
              <div className="section-card">
                <h2 className="section-title">Why this feels real</h2>
                <p className="section-copy">
                  The interviewer opens the call, asks follow-ups, and keeps the conversation moving like a
                  live screening or mock interview.
                </p>
              </div>
              <div className="section-card">
                <h2 className="section-title">What gets reviewed</h2>
                <p className="section-copy">
                  After you end the interview, the app scores confidence, clarity, structure, and specificity
                  based on the session transcript.
                </p>
              </div>
              <div className="section-card">
                <h2 className="section-title">Portfolio angle</h2>
                <p className="section-copy">
                  It shows realtime voice UX, feedback design, and a practical AI workflow that works across
                  different industries and is easy to explain on LinkedIn or in a case study.
                </p>
              </div>
            </div>
          </div>
        </section>

        <RealtimeVoiceStudio />
      </div>
    </main>
  );
}
