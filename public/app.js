// ==========================================================================
// Ultron AI Tutor — App Logic
// ==========================================================================

const API_BASE = window.__ULTRON_API_BASE_URL__;

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* ---------------------------------------------------------------------- */
/* Auth screen wiring                                                     */
/* ---------------------------------------------------------------------- */

function initAuthTabs() {
  $all(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $all(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const which = tab.dataset.authTab;
      $("#signin-form").classList.toggle("hidden", which !== "signin");
      $("#signup-form").classList.toggle("hidden", which !== "signup");
      hideAuthError();
    });
  });
}

function showAuthError(msg) {
  const el = $("#auth-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}
function hideAuthError() {
  $("#auth-error").classList.add("hidden");
}

function initAuthForms() {
  $("#signin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthError();
    const email = $("#signin-email").value.trim();
    const password = $("#signin-password").value;
    try {
      await window.UltronAuth.signInWithEmail(email, password);
    } catch (err) {
      showAuthError(window.UltronAuth.mapAuthError(err));
    }
  });

  $("#signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthError();
    const name = $("#signup-name").value.trim();
    const email = $("#signup-email").value.trim();
    const password = $("#signup-password").value;
    try {
      await window.UltronAuth.signUpWithEmail(name, email, password);
    } catch (err) {
      showAuthError(window.UltronAuth.mapAuthError(err));
    }
  });

  $("#google-signin").addEventListener("click", async () => {
    hideAuthError();
    try {
      await window.UltronAuth.signInWithGoogle();
    } catch (err) {
      showAuthError(window.UltronAuth.mapAuthError(err));
    }
  });

  $("#forgot-password").addEventListener("click", async () => {
    hideAuthError();
    const email = $("#signin-email").value.trim();
    if (!email) {
      showAuthError("Enter your email above first, then tap Forgot password.");
      return;
    }
    try {
      await window.UltronAuth.resetPassword(email);
      showAuthError("Password reset email sent — check your inbox.");
    } catch (err) {
      showAuthError(window.UltronAuth.mapAuthError(err));
    }
  });

  $("#logout-btn").addEventListener("click", () => window.UltronAuth.signOutUser());
}

/* ---------------------------------------------------------------------- */
/* Navigation                                                             */
/* ---------------------------------------------------------------------- */

function goToView(name) {
  $all(".view").forEach((v) => v.classList.remove("active-view"));
  $(`#view-${name}`)?.classList.add("active-view");
  $all(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
}

function initNav() {
  $all("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => goToView(btn.dataset.nav));
  });

  $all(".quick-action").forEach((btn) => {
    btn.addEventListener("click", () => handleQuickAction(btn.dataset.quick));
  });

  $("#open-profile-from-home").addEventListener("click", () => goToView("profile"));

  $("#floating-orb").addEventListener("click", () => {
    goToView("chat");
    startVoiceInput();
  });
  let orbPressTimer;
  $("#floating-orb").addEventListener("touchstart", () => {
    orbPressTimer = setTimeout(() => goToView("chat"), 500);
  });
  $("#floating-orb").addEventListener("touchend", () => clearTimeout(orbPressTimer));

  // Study subtabs
  $all("[data-study-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      $all("[data-study-tab]").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      $all("#view-study .study-pane").forEach((p) => p.classList.remove("active-pane"));
      $(`#study-${tab.dataset.studyTab}`).classList.add("active-pane");
    });
  });

  // Learn subtabs
  $all("[data-learn-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      $all("[data-learn-tab]").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      $all("#view-learn .study-pane").forEach((p) => p.classList.remove("active-pane"));
      $(`#learn-${tab.dataset.learnTab}`).classList.add("active-pane");
    });
  });
}

function handleQuickAction(action) {
  switch (action) {
    case "chat": goToView("chat"); break;
    case "pdf": goToView("learn"); $all("[data-learn-tab]").find(t => t.dataset.learnTab === "pdf")?.click(); break;
    case "camera": goToView("learn"); $all("[data-learn-tab]").find(t => t.dataset.learnTab === "camera")?.click(); break;
    case "voice": goToView("learn"); $all("[data-learn-tab]").find(t => t.dataset.learnTab === "voice")?.click(); break;
    case "notes": goToView("study"); $all("[data-study-tab]").find(t => t.dataset.studyTab === "notes")?.click(); break;
    case "quiz": goToView("study"); $all("[data-study-tab]").find(t => t.dataset.studyTab === "quiz")?.click(); break;
  }
}

/* ---------------------------------------------------------------------- */
/* Chat                                                                    */
/* ---------------------------------------------------------------------- */

let chatHistory = [];
let pendingFiles = [];

function appendMessage(role, text) {
  $("#chat-empty")?.remove();
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  $("#chat-messages").appendChild(el);
  $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
  return el;
}

async function sendChatMessage() {
  const input = $("#chat-text-input");
  const text = input.value.trim();
  if (!text && pendingFiles.length === 0) return;

  appendMessage("user", text || `(${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} attached)`);
  chatHistory.push({ role: "user", content: text });
  input.value = "";
  autoGrow(input);

  const filesToSend = pendingFiles;
  clearAttachments();

  const thinkingEl = appendMessage("ai", "…");

  try {
    const token = await window.UltronAuth.getIdToken();
    const form = new FormData();
    form.append("message", text);
    form.append("history", JSON.stringify(chatHistory.slice(-20)));
    filesToSend.forEach((f) => form.append("files", f));

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });

    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const data = await res.json();
    thinkingEl.textContent = data.reply || "Sorry, I couldn't generate a response.";
    chatHistory.push({ role: "assistant", content: data.reply || "" });
    $("#response-actions").classList.remove("hidden");
  } catch (err) {
    thinkingEl.textContent = "Ultron's backend isn't reachable right now. Check that server.js is running and your AI provider keys are configured.";
    console.error(err);
  }
}

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

function clearAttachments() {
  pendingFiles = [];
  const box = $("#chat-attachments");
  box.innerHTML = "";
  box.classList.add("hidden");
}

function renderAttachments() {
  const box = $("#chat-attachments");
  box.innerHTML = "";
  pendingFiles.forEach((f, i) => {
    const chip = document.createElement("div");
    chip.className = "subtab";
    chip.style.cursor = "default";
    chip.textContent = `${f.name.slice(0, 18)} ✕`;
    chip.addEventListener("click", () => {
      pendingFiles.splice(i, 1);
      renderAttachments();
    });
    box.appendChild(chip);
  });
  box.classList.toggle("hidden", pendingFiles.length === 0);
}

function initChat() {
  $("#chat-send").addEventListener("click", sendChatMessage);
  $("#chat-text-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  $("#chat-text-input").addEventListener("input", (e) => autoGrow(e.target));

  $("#chat-attach-file").addEventListener("click", () => $("#chat-file-input").click());
  $("#chat-attach-camera").addEventListener("click", () => $("#chat-file-input").click());
  $("#chat-file-input").addEventListener("change", (e) => {
    const max = window.__ULTRON_APP_CONFIG__.maxUploadFilesPerMessage;
    pendingFiles = [...pendingFiles, ...[...e.target.files]].slice(0, max);
    renderAttachments();
  });

  $("#chat-attach-voice").addEventListener("click", startVoiceInput);

  $("#chat-new").addEventListener("click", () => {
    chatHistory = [];
    clearAttachments();
    $("#chat-messages").innerHTML = '<div class="chat-empty" id="chat-empty"><div class="orb-mark large"></div><p>Ask about homework, coding, math, science, essays, or anything you\'re studying.</p></div>';
    $("#response-actions").classList.add("hidden");
  });

  $all("#response-actions button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const presets = {
        "quiz-me": "Quiz me on what we just discussed.",
        "simplify": "Can you simplify that explanation?",
        "explain-again": "Please explain that again, a different way.",
        "generate-notes": "Turn that into concise study notes.",
        "save": "(saved to your notes)",
      };
      const action = btn.dataset.action;
      if (action === "save") {
        appendMessage("ai", "Saved to Study → Notes.");
        return;
      }
      $("#chat-text-input").value = presets[action] || "";
      sendChatMessage();
    });
  });

  $("#home-ask-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const text = e.target.value.trim();
      if (!text) return;
      e.target.value = "";
      goToView("chat");
      $("#chat-text-input").value = text;
      sendChatMessage();
    }
  });
  $("#home-orb-btn").addEventListener("click", () => {
    goToView("chat");
    startVoiceInput();
  });
}

function startVoiceInput() {
  // Placeholder hook: wire this to MediaRecorder + POST /api/voice/transcribe (Whisper)
  // once a hosted Whisper endpoint is configured in server.js.
  appendMessage("ai", "Voice input needs a configured speech-to-text endpoint (Whisper) on the backend — see server.js /api/voice/transcribe.");
}

/* ---------------------------------------------------------------------- */
/* Learn: PDF / Camera uploads                                            */
/* ---------------------------------------------------------------------- */

function initLearn() {
  $("#pdf-upload-input").addEventListener("change", (e) => handleLearnUpload(e.target.files[0], "pdf"));
  $("#camera-upload-input").addEventListener("change", (e) => handleLearnUpload(e.target.files[0], "image"));
}

async function handleLearnUpload(file, kind) {
  if (!file) return;
  goToView("chat");
  appendMessage("user", `Uploaded ${kind === "pdf" ? "PDF" : "image"}: ${file.name}`);
  const thinkingEl = appendMessage("ai", "…");
  try {
    const token = await window.UltronAuth.getIdToken();
    const form = new FormData();
    form.append("files", file);
    form.append("message", kind === "pdf" ? "Summarize this PDF." : "Explain what's in this image.");
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const data = await res.json();
    thinkingEl.textContent = data.reply || "Sorry, I couldn't process that file.";
  } catch (err) {
    thinkingEl.textContent = "Couldn't reach the backend for file processing. Check server.js and your Docling/vision provider setup.";
    console.error(err);
  }
}

/* ---------------------------------------------------------------------- */
/* Profile / Home population from the signed-in user                      */
/* ---------------------------------------------------------------------- */

function populateUserUI(user) {
  const initial = (user.displayName || user.email || "U").charAt(0).toUpperCase();
  const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || user.email || "U")}`;
  const avatarUrl = user.photoURL || fallbackAvatar;

  $("#user-avatar").src = avatarUrl;
  $("#profile-avatar").src = avatarUrl;
  $("#greeting-name").textContent = user.displayName || user.email?.split("@")[0] || "Student";
  $("#profile-name").textContent = user.displayName || "Student";
  $("#profile-email").textContent = user.email || "";

  const hour = new Date().getHours();
  $("#greeting-text").textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/* ---------------------------------------------------------------------- */
/* Boot                                                                    */
/* ---------------------------------------------------------------------- */

function initAll() {
  initAuthTabs();
  initAuthForms();
  initNav();
  initChat();
  initLearn();

  window.UltronAuth.watchAuthState((user) => {
    if (user) {
      populateUserUI(user);
      $("#auth-screen").classList.add("hidden");
      $("#app-shell").classList.remove("hidden");
    } else {
      $("#app-shell").classList.add("hidden");
      $("#auth-screen").classList.remove("hidden");
    }
  });
}

document.addEventListener("DOMContentLoaded", initAll);
