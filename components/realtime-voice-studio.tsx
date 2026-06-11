"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildMockFeedback,
  buildSessionPrompt,
  difficultyLevels,
  interviewRoles,
  type FeedbackSummary,
  type InterviewProfile,
  voiceStyles
} from "@/lib/interview";

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type ReviewState = "idle" | "reviewing" | "done";

type SessionPayload = {
  clientSecret: string;
  model: string;
  prompt: string;
  error?: string;
  mock?: boolean;
};

type TranscriptEntry = {
  id: string;
  role: "system" | "user" | "assistant";
  text: string;
};

const initialProfile: InterviewProfile = {
  role: "AI Engineer",
  difficulty: "standard",
  voiceStyle: "supportive",
  goal: "Build confidence and answer with structure"
};

const interviewGoal =
  "Start with a warm opener, ask about a recent experience, then follow up like a real interviewer.";

const transcriptSeed: TranscriptEntry[] = [
  {
    id: "system-1",
    role: "system",
    text: "Connect a session to start the interview."
  }
];

const interviewerIntro =
  "Hi, I’m your interviewer. I’ll keep this practical and realistic. Let’s start with a quick introduction.";

function buildReviewTranscript(entries: TranscriptEntry[]) {
  return entries
    .filter((entry) => entry.role !== "system" || entry.text !== "Connect a session to start the interview.")
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`)
    .join("\n\n");
}

function buildTranscriptEntry(role: TranscriptEntry["role"], text: string) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    text
  };
}

export function RealtimeVoiceStudio() {
  const [profile, setProfile] = useState<InterviewProfile>(initialProfile);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [reviewState, setReviewState] = useState<ReviewState>("idle");
  const [reviewFeedback, setReviewFeedback] = useState<FeedbackSummary | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(transcriptSeed);
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: 16 }, () => 18));
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const sessionPreview = useMemo(
    () =>
      buildSessionPrompt({
        ...profile,
        goal: interviewGoal
      }),
    [profile]
  );

  function log(message: string) {
    console.debug(message);
  }

  function appendTranscript(role: TranscriptEntry["role"], text: string) {
    setTranscript((current) => [buildTranscriptEntry(role, text), ...current].slice(0, 20));
  }

  function stopAudioAnalysis() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setMicLevel(0);
    setWaveform(Array.from({ length: 16 }, () => 18));
  }

  function cleanupConnection() {
    dataChannelRef.current?.close();
    peerConnectionRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    dataChannelRef.current = null;
    peerConnectionRef.current = null;
    streamRef.current = null;
    remoteStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    stopAudioAnalysis();
  }

  function startAudioAnalysis(stream: MediaStream) {
    stopAudioAnalysis();

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      analyser.getByteFrequencyData(buffer);
      const bars = Array.from({ length: 16 }, (_, index) => {
        const sample = buffer[index] ?? 0;
        const normalized = sample / 255;
        return Math.max(12, Math.round(12 + normalized * 68));
      });

      setWaveform(bars);
      const average = buffer.reduce((sum, value) => sum + value, 0) / buffer.length;
      setMicLevel(Math.round((average / 255) * 100));
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);
  }

  async function generateReview(transcriptSnapshot: TranscriptEntry[]) {
    const transcriptText = buildReviewTranscript(transcriptSnapshot) || "No transcript captured.";

    setReviewState("reviewing");
    setReviewError(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profile,
          transcript: transcriptText,
          question: interviewGoal
        })
      });

      const data = (await response.json()) as { feedback: FeedbackSummary; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? `Review request failed with ${response.status}`);
      }

      setReviewFeedback(data.feedback);
      setReviewState("done");
    } catch (reviewErr) {
      setReviewFeedback(buildMockFeedback(transcriptText, profile));
      setReviewState("done");
      setReviewError(reviewErr instanceof Error ? reviewErr.message : "Unable to generate review.");
    }
  }

  async function endInterview() {
    const transcriptSnapshot = transcript;
    cleanupConnection();
    setConnectionState("idle");
    log("Session ended.");
    appendTranscript("system", "Interview ended. Generating feedback now.");
    await generateReview(transcriptSnapshot);
  }

  function resetSession() {
    cleanupConnection();
    setConnectionState("idle");
    setReviewState("idle");
    setReviewFeedback(null);
    setReviewError(null);
    setError(null);
    setTranscript(transcriptSeed);
  }

  useEffect(() => {
    return () => {
      cleanupConnection();
    };
    // The cleanup is intentionally tied to unmount, not rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setConnectionState("connecting");
    setError(null);
    setReviewState("idle");
    setReviewFeedback(null);
    setReviewError(null);
    setTranscript(transcriptSeed);

    try {
      const sessionResponse = await fetch("/api/realtime-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profile,
          goal: interviewGoal
        })
      });

      if (!sessionResponse.ok) {
        const errorBody = (await sessionResponse.json().catch(() => null)) as Partial<SessionPayload> | null;
        throw new Error(errorBody?.error ?? `Session request failed with ${sessionResponse.status}`);
      }

      const sessionData = (await sessionResponse.json()) as SessionPayload;
      if (!sessionData.clientSecret) {
        throw new Error(sessionData.error ?? "Realtime session could not be created.");
      }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const peerConnection = new RTCPeerConnection();
      const dataChannel = peerConnection.createDataChannel("openai-events");

      peerConnectionRef.current = peerConnection;
      dataChannelRef.current = dataChannel;
      streamRef.current = micStream;
      remoteStreamRef.current = new MediaStream();

      micStream.getTracks().forEach((track) => peerConnection.addTrack(track, micStream));
      startAudioAnalysis(micStream);

      peerConnection.ontrack = (event) => {
        const remoteStream = remoteStreamRef.current ?? new MediaStream();
        event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
        remoteStreamRef.current = remoteStream;

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
      };

      dataChannel.onopen = () => {
        dataChannel.send(
          JSON.stringify({
            type: "session.update",
            session: {
              type: "realtime",
              instructions: `${sessionData.prompt} Start by greeting the user as the interviewer, then ask the first interview question.`,
              audio: {
                input: {
                  turn_detection: { type: "server_vad" }
                },
                output: {
                  voice: "alloy"
                }
              }
            }
          })
        );
        dataChannel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio", "text"],
              instructions:
                "Greet the user as the interviewer, briefly introduce yourself, and ask the first interview question."
            }
          })
        );
      };

      dataChannel.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type?: string;
            delta?: string;
            text?: string;
            transcript?: string;
            role?: "system" | "user" | "assistant";
            item?: {
              role?: "system" | "user" | "assistant";
              text?: string;
              transcript?: string;
            };
          };

          const text =
            payload.delta ?? payload.transcript ?? payload.text ?? payload.item?.transcript ?? payload.item?.text;

          if (!text) {
            return;
          }

          if (payload.type?.includes("input_audio_transcription")) {
            appendTranscript("user", text);
          } else if (
            payload.type === "response.output_audio_transcript.delta" ||
            payload.type === "response.output_text.delta"
          ) {
            appendTranscript("assistant", text);
          } else if (payload.item?.role) {
            appendTranscript(payload.item.role, text);
          } else {
            appendTranscript(payload.role ?? "assistant", text);
          }
        } catch {
          log(String(event.data));
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const realtimeResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.clientSecret}`,
          "Content-Type": "application/sdp"
        },
        body: offer.sdp ?? ""
      });

      if (!realtimeResponse.ok) {
        throw new Error(`Realtime negotiation failed with ${realtimeResponse.status}`);
      }

      const answerSdp = await realtimeResponse.text();
      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp
      });

      setConnectionState("connected");
      appendTranscript("assistant", interviewerIntro);
      appendTranscript("system", "The interviewer has opened the call. Answer out loud to continue.");
    } catch (connectError) {
      cleanupConnection();
      setConnectionState("error");
      setError(connectError instanceof Error ? connectError.message : "Unable to start session.");
    }
  }

  const reviewConfidence = reviewFeedback?.confidence ?? null;
  const reviewClarity = reviewFeedback?.clarity ?? null;
  const reviewSpecificity = reviewFeedback?.specificity ?? null;
  const reviewFillerWords = reviewFeedback?.fillerWords ?? null;

  return (
    <section className="voice-studio">
      <div className="voice-layout">
        <div className="session-card">
          <div className="status-bar">
            <span className="status-chip">State: {connectionState}</span>
            <span className="status-chip">Transport: WebRTC</span>
            <span className="status-chip">Model: gpt-realtime-2</span>
            <span className="status-chip">Mic level: {micLevel}%</span>
          </div>

          <div className="question-card">
            <div className="question-label">Interview focus</div>
            <h3 className="question">Voice-only mock interview</h3>
            <p className="note">
              {sessionPreview.slice(0, 240)}
              {sessionPreview.length > 240 ? "..." : ""}
            </p>
          </div>

          <div className="setup-form">
            <div className="field-grid">
              <div className="field">
                <label htmlFor="voice-role">Target role</label>
                <select
                  id="voice-role"
                  value={profile.role}
                  onChange={(event) => setProfile((current) => ({ ...current, role: event.target.value }))}
                >
                  {interviewRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="voice-difficulty">Difficulty</label>
                <select
                  id="voice-difficulty"
                  value={profile.difficulty}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      difficulty: event.target.value as InterviewProfile["difficulty"]
                    }))
                  }
                >
                  {difficultyLevels.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="voice-style">Coach style</label>
                <select
                  id="voice-style"
                  value={profile.voiceStyle}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      voiceStyle: event.target.value as InterviewProfile["voiceStyle"]
                    }))
                  }
                >
                  {voiceStyles.map((style) => (
                    <option key={style.value} value={style.value}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="voice-goal">Practice goal</label>
                <textarea
                  id="voice-goal"
                  value={profile.goal}
                  onChange={(event) => setProfile((current) => ({ ...current, goal: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="action-row">
            <button
              className="btn btn-primary"
              onClick={connectionState === "connected" ? endInterview : connect}
              disabled={connectionState === "connecting" || reviewState === "reviewing"}
            >
              {connectionState === "connected"
                ? reviewState === "reviewing"
                  ? "Reviewing..."
                  : "End interview and review"
                : connectionState === "connecting"
                  ? "Connecting..."
                  : "Start voice interview"}
            </button>
            <button className="btn btn-secondary" onClick={resetSession}>
              Reset
            </button>
          </div>

          <audio ref={remoteAudioRef} autoPlay playsInline />

          <div className="waveform-card">
            <div className="waveform-header">
              <div>
                <div className="waveform-title">Live waveform</div>
                <div className="waveform-subtitle">
                  {connectionState === "connected"
                    ? "Microphone activity is being sampled in real time."
                    : "Connect a session to animate the mic response."}
                </div>
              </div>
              <div className="waveform-badge">{connectionState === "connected" ? "Live" : "Idle"}</div>
            </div>

            <div className="waveform-bars" aria-hidden="true">
              {waveform.map((bar, index) => (
                <span
                  key={`${index}-${bar}`}
                  className="waveform-bar"
                  style={{
                    height: `${bar}px`,
                    opacity: connectionState === "connected" ? 0.6 + index * 0.02 : 0.28
                  }}
                />
              ))}
            </div>
          </div>

          {error ? <p className="error-copy">{error}</p> : null}
        </div>

        <div className="feedback-card">
          <div className="eyebrow">Post-call review</div>
          <h2 className="section-title">What the coach returns</h2>
          <p className="section-copy">
            {reviewState === "idle"
              ? "End the interview to generate a structured review."
              : reviewState === "reviewing"
                ? "Scoring the conversation now..."
                : "Here is the post-call feedback from the interview."}
          </p>

          {reviewState === "reviewing" ? (
            <div className="review-loading" aria-live="polite">
              <span className="review-spinner" aria-hidden="true" />
              <div>
                <div className="review-loading-title">Updating feedback</div>
                <div className="review-loading-copy">
                  The coach is scoring confidence, clarity, structure, and specificity right now.
                </div>
              </div>
            </div>
          ) : null}

          <div className="feedback-grid">
            <div className="score-card">
              <div className={`score-value ${reviewConfidence === null ? "score-value-pending" : ""}`}>
                {reviewConfidence ?? "Pending"}
              </div>
              <div className="score-label">Confidence</div>
            </div>
            <div className="score-card">
              <div className={`score-value ${reviewClarity === null ? "score-value-pending" : ""}`}>
                {reviewClarity ?? "Pending"}
              </div>
              <div className="score-label">Clarity</div>
            </div>
            <div className="score-card">
              <div className={`score-value ${reviewSpecificity === null ? "score-value-pending" : ""}`}>
                {reviewSpecificity ?? "Pending"}
              </div>
              <div className="score-label">Specificity</div>
            </div>
            <div className="score-card">
              <div className={`score-value ${reviewFillerWords === null ? "score-value-pending" : ""}`}>
                {reviewFillerWords ?? "Pending"}
              </div>
              <div className="score-label">Filler-word control</div>
            </div>
          </div>

          <div className="roadmap-list">
            <div className="roadmap-item">
              <strong>Strengths</strong>
              <div>{reviewFeedback?.strengths[0] ?? "End the interview to see strengths."}</div>
            </div>
            <div className="roadmap-item">
              <strong>Improve next</strong>
              <div>{reviewFeedback?.improvements[0] ?? "End the interview to get one improvement."}</div>
            </div>
            <div className="roadmap-item">
              <strong>Next drill</strong>
              <div>{reviewFeedback?.nextDrill ?? "End the interview to get the next drill."}</div>
            </div>
          </div>

          {reviewError ? <p className="error-copy">{reviewError}</p> : null}
        </div>
      </div>
    </section>
  );
}
