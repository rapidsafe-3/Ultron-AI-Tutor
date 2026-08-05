# Ultron AI Tutor

## Run it

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Sign up or sign in with Google — auth is fully wired to your Firebase project (`ultron-ai-tutor`).

## What's real vs. a stub right now

**Real and working:**
- Firebase email/password + Google sign-in, account creation, password reset
- All 6 modes navigable (Home, Chat, Study, Learn, Progress, Profile) with the Gemini-style white UI
- File uploads (PDF/image) from Chat and Learn, sent to the backend
- Express server with auth-protected routes, multer uploads, and a firebase-admin token-verification middleware

**Stubbed, waiting on your model endpoints** (fill in `.env` — see `.env.example`):
- `QWEN_CHAT_ENDPOINT` — main chat/study/homework model (Qwen3). Without it, `/api/chat` returns a demo echo response.
- `VISION_ENDPOINT` — Qwen2.5-VL for images/diagrams/graphs.
- `DOCLING_ENDPOINT` — PDF text extraction.
- `WHISPER_ENDPOINT` — speech-to-text for voice input.
- `KOKORO_ENDPOINT` — text-to-speech.
- `CHROMADB_ENDPOINT` — long-term memory search (weak subjects, past chats).

Each of these needs to be a running service (self-hosted via vLLM/Ollama for Qwen, a Whisper/Kokoro server, a Docling service, a Chroma instance) — `server.js` calls them over HTTP but doesn't run them in-process.

Also missing a `FIREBASE_SERVICE_ACCOUNT_JSON` (or `GOOGLE_APPLICATION_CREDENTIALS`) means the backend runs in **dev mode**: it accepts requests without verifying the Firebase ID token. Get a service account key from Firebase Console → Project Settings → Service Accounts, and set it before deploying.

## Next build passes (not yet implemented)

- Firestore reads/writes for chats, notes, planner, progress, flashcards, quizzes (currently only the `users` doc is created on sign-up)
- Study/Progress/Learn screens show empty states — they render but aren't wired to real data yet
- Quiz/flashcard generation endpoints exist (`/api/quiz/generate`) but aren't called from the Study UI yet
- Voice recording (MediaRecorder → `/api/voice/transcribe`) and orb long-press "quick command" are placeholders
- 
