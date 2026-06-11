# Voice Interview Coach

An AI interview practice tool built to be a strong LinkedIn portfolio project.

## What it does

- Lets a user pick a role, difficulty, and coach tone
- Generates interview questions with a supportive or challenging style
- Scores a transcript with feedback focused on confidence, clarity, structure, specificity, and filler words
- Provides a realtime voice path using a short-lived session token, browser WebRTC, and live event logs

## Why this is a good portfolio project

- It solves a real problem for students and early-career candidates
- It shows product thinking, UX, and AI integration
- It has a demo-friendly flow that is easy to explain on LinkedIn

## Tech stack

- Next.js
- TypeScript
- OpenAI API

## Environment

Create a `.env.local` file from `.env.example`.

Required for live voice:

- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL` if you want to override the default realtime model

## Run locally

```bash
npm install
npm run dev
```

## Suggested next steps

1. Replace the live event log with a transcript panel and waveform UI.
2. Add speech-to-text streaming and turn-taking.
3. Save session history so users can track improvement over time.
4. Add a polished demo video and LinkedIn case study.
