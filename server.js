// ==========================================================================
// Ultron AI Tutor — Backend (server.js)
//
// Responsibilities per the blueprint:
//   - AI requests (chat/study/homework/coding/notes)
//   - PDF processing
//   - Voice processing
//   - Vision processing
//   - Memory search
//   - Authentication middleware
//   - File uploads
//
// This file wires up real Firebase auth verification, file uploads, and
// route structure. The actual model calls (Qwen3, Qwen2.5-VL, Whisper,
// Kokoro TTS, Docling, ChromaDB) are marked with TODO — plug in your
// self-hosted endpoints or a provider (Together/Fireworks/Replicate/etc.)
// and an API key via .env.
// ==========================================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const admin = require("firebase-admin");

// --------------------------------------------------------------------------
// Firebase Admin init
// --------------------------------------------------------------------------
// Provide credentials via env vars (recommended) or a service-account.json
// file referenced by GOOGLE_APPLICATION_CREDENTIALS. Never commit real
// service-account keys to source control.

let firebaseReady = false;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseReady = true;
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    firebaseReady = true;
  } else {
    console.warn(
      "[Ultron] No Firebase Admin credentials found (FIREBASE_SERVICE_ACCOUNT_JSON or " +
      "GOOGLE_APPLICATION_CREDENTIALS). Auth-protected routes will run in DEV MODE " +
      "(unverified) until you add credentials — see .env.example."
    );
  }
} catch (err) {
  console.error("[Ultron] Failed to initialize Firebase Admin:", err.message);
}

// --------------------------------------------------------------------------
// App setup
// --------------------------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false })); // CSP off by default for dev; configure for prod
app.use(compression());
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const UPLOAD_DIR = path.join(__dirname, "uploads");
const TEMP_DIR = path.join(__dirname, "temp");
[UPLOAD_DIR, TEMP_DIR].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 5 }, // 25MB/file, 5 files/request
});

// Serve the frontend
app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------------------------------
// Auth middleware
// --------------------------------------------------------------------------

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!firebaseReady) {
    // DEV MODE: allow requests through with a placeholder uid so the rest of
    // the app is testable before Firebase Admin credentials are configured.
    req.user = { uid: "dev-user" };
    return next();
  }

  if (!token) return res.status(401).json({ error: "Missing Authorization bearer token." });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("[Ultron] Token verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

// --------------------------------------------------------------------------
// AI provider helpers  (TODO: point these at your real endpoints)
// --------------------------------------------------------------------------

/**
 * Main chat/study/homework/coding model — Qwen3 per the blueprint.
 * Point QWEN_CHAT_ENDPOINT at a self-hosted vLLM/Ollama server, or swap
 * this for any OpenAI-compatible chat completions endpoint.
 */
async function callChatModel({ message, history }) {
  const endpoint = process.env.QWEN_CHAT_ENDPOINT;
  const apiKey = process.env.QWEN_API_KEY;

  if (!endpoint) {
    return `(Demo response — no QWEN_CHAT_ENDPOINT configured in .env)\n\nYou asked: "${message}"\n\nOnce you set QWEN_CHAT_ENDPOINT and QWEN_API_KEY, this will call your Qwen3 endpoint for a real answer.`;
  }

  const messages = [
    { role: "system", content: "You are Ultron, a friendly, encouraging AI study tutor. Explain clearly, check understanding, and keep answers focused." },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  const { data } = await axios.post(
    endpoint,
    { model: process.env.QWEN_MODEL_NAME || "qwen3", messages, max_tokens: 1024 },
    { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }
  );

  // Adjust this to match your endpoint's response shape (OpenAI-style shown).
  return data?.choices?.[0]?.message?.content || "No response from the model.";
}

/** Vision model for images/diagrams/graphs — Qwen2.5-VL. */
async function callVisionModel({ imagePath, prompt }) {
  const endpoint = process.env.VISION_ENDPOINT;
  if (!endpoint) {
    return `(Demo response — no VISION_ENDPOINT configured) I received an image at ${path.basename(imagePath)} but can't analyze it until Qwen2.5-VL is wired up.`;
  }
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString("base64");
  const { data } = await axios.post(endpoint, {
    model: process.env.VISION_MODEL_NAME || "qwen2.5-vl",
    prompt,
    image_base64: base64,
  });
  return data?.result || "No response from the vision model.";
}

/** PDF understanding — Docling for extraction, then the chat model to summarize/answer. */
async function extractPdfText(pdfPath) {
  const endpoint = process.env.DOCLING_ENDPOINT;
  if (!endpoint) {
    return null; // caller falls back to a generic note
  }
  const form = new (require("form-data"))();
  form.append("file", fs.createReadStream(pdfPath));
  const { data } = await axios.post(endpoint, form, { headers: form.getHeaders() });
  return data?.text || null;
}

/** Speech-to-text — Whisper. */
async function transcribeAudio(audioPath) {
  const endpoint = process.env.WHISPER_ENDPOINT;
  if (!endpoint) return null;
  const form = new (require("form-data"))();
  form.append("file", fs.createReadStream(audioPath));
  const { data } = await axios.post(endpoint, form, { headers: form.getHeaders() });
  return data?.text || null;
}

/** Text-to-speech — Kokoro TTS. Returns an audio file path or URL. */
async function synthesizeSpeech(text) {
  const endpoint = process.env.KOKORO_ENDPOINT;
  if (!endpoint) return null;
  const { data } = await axios.post(endpoint, { text }, { responseType: "arraybuffer" });
  const outPath = path.join(TEMP_DIR, `${uuidv4()}.mp3`);
  fs.writeFileSync(outPath, data);
  return outPath;
}

// --------------------------------------------------------------------------
// Routes
// --------------------------------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    firebaseAdmin: firebaseReady,
    integrations: {
      chatModel: !!process.env.QWEN_CHAT_ENDPOINT,
      vision: !!process.env.VISION_ENDPOINT,
      docling: !!process.env.DOCLING_ENDPOINT,
      whisper: !!process.env.WHISPER_ENDPOINT,
      kokoro: !!process.env.KOKORO_ENDPOINT,
    },
  });
});

/**
 * POST /api/chat
 * multipart/form-data: message (string), history (JSON string), files[]
 * Routes to vision/PDF/chat handling depending on what was attached.
 */
app.post("/api/chat", requireAuth, upload.array("files", 5), async (req, res) => {
  try {
    const message = req.body.message || "";
    let history = [];
    try { history = JSON.parse(req.body.history || "[]"); } catch { /* ignore */ }
    const files = req.files || [];

    let reply;

    const imageFile = files.find((f) => f.mimetype.startsWith("image/"));
    const pdfFile = files.find((f) => f.mimetype === "application/pdf");

    if (imageFile) {
      reply = await callVisionModel({ imagePath: imageFile.path, prompt: message || "Explain what's in this image." });
    } else if (pdfFile) {
      const extracted = await extractPdfText(pdfFile.path);
      const contextMsg = extracted
        ? `A student uploaded a PDF. Extracted text:\n\n${extracted.slice(0, 8000)}\n\nStudent's request: ${message || "Summarize this."}`
        : `A student uploaded a PDF named "${pdfFile.originalname}" but text extraction isn't configured yet. Politely explain that once DOCLING_ENDPOINT is set you'll be able to read it, and ask what they'd like help with in the meantime.`;
      reply = await callChatModel({ message: contextMsg, history });
    } else {
      reply = await callChatModel({ message, history });
    }

    res.json({ reply });
  } catch (err) {
    console.error("[Ultron] /api/chat error:", err.message);
    res.status(500).json({ error: "Something went wrong generating a response." });
  }
});

/**
 * POST /api/voice/transcribe
 * multipart/form-data: audio (single file)
 */
app.post("/api/voice/transcribe", requireAuth, upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file provided." });
    const text = await transcribeAudio(req.file.path);
    if (text === null) {
      return res.status(501).json({ error: "WHISPER_ENDPOINT not configured on the server." });
    }
    res.json({ text });
  } catch (err) {
    console.error("[Ultron] /api/voice/transcribe error:", err.message);
    res.status(500).json({ error: "Transcription failed." });
  }
});

/**
 * POST /api/voice/speak
 * JSON: { text }
 * Returns an audio file.
 */
app.post("/api/voice/speak", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text." });
    const audioPath = await synthesizeSpeech(text);
    if (!audioPath) {
      return res.status(501).json({ error: "KOKORO_ENDPOINT not configured on the server." });
    }
    res.sendFile(audioPath);
  } catch (err) {
    console.error("[Ultron] /api/voice/speak error:", err.message);
    res.status(500).json({ error: "Speech synthesis failed." });
  }
});

/**
 * POST /api/quiz/generate
 * JSON: { topic, count }
 * Uses the chat model to produce structured quiz JSON.
 */
app.post("/api/quiz/generate", requireAuth, async (req, res) => {
  try {
    const { topic, count = 5 } = req.body;
    if (!topic) return res.status(400).json({ error: "Missing topic." });

    const prompt = `Create ${count} multiple-choice quiz questions about "${topic}". ` +
      `Respond ONLY with JSON: an array of objects with keys "question", "options" (array of 4 strings), and "answerIndex" (0-based). No prose, no markdown fences.`;

    const raw = await callChatModel({ message: prompt, history: [] });
    let quiz;
    try {
      quiz = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      return res.status(502).json({ error: "Model did not return valid quiz JSON.", raw });
    }
    res.json({ quiz });
  } catch (err) {
    console.error("[Ultron] /api/quiz/generate error:", err.message);
    res.status(500).json({ error: "Quiz generation failed." });
  }
});

/**
 * Memory search placeholder — ChromaDB.
 * POST /api/memory/search  JSON: { query }
 */
app.post("/api/memory/search", requireAuth, async (req, res) => {
  const endpoint = process.env.CHROMADB_ENDPOINT;
  if (!endpoint) {
    return res.status(501).json({ error: "CHROMADB_ENDPOINT not configured on the server.", results: [] });
  }
  try {
    const { query } = req.body;
    const { data } = await axios.post(`${endpoint}/query`, { query, userId: req.user.uid });
    res.json({ results: data.results || [] });
  } catch (err) {
    console.error("[Ultron] /api/memory/search error:", err.message);
    res.status(500).json({ error: "Memory search failed." });
  }
});

// Fallback to index.html for any non-API route (single-page app)
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`[Ultron] Server running on http://localhost:${PORT}`);
  if (!firebaseReady) console.log("[Ultron] Running in DEV MODE — auth is unverified until Firebase Admin credentials are set.");
});
