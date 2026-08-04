import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgjd69-vB0YaErcAYHFuQ3-IgP5iMUUp4",
  authDomain: "ultron-ai-tutor.firebaseapp.com",
  projectId: "ultron-ai-tutor",
  storageBucket: "ultron-ai-tutor.firebasestorage.app",
  messagingSenderId: "1020040458194",
  appId: "1:1020040458194:web:36f57a13059c2fc154620b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let userState = {
    name: "Student",
    fullName: "Student",
    xp: 12450,
    context: "General Assistant"
};

window.showAppScreen = function(screenId) {
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

window.navTo = function(viewId, contextTitle = null) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    document.querySelectorAll('.sidebar .nav-item').forEach(btn => btn.classList.remove('active'));

    if (contextTitle) {
        userState.context = contextTitle;
        document.getElementById('header-title').innerText = contextTitle;
    } else {
        userState.context = "Command Center";
        document.getElementById('header-title').innerText = "Command Center";
    }

    const globalInput = document.getElementById('global-input');
    if (viewId === 'view-focus' || viewId === 'view-profile' || viewId === 'view-rooms') {
        globalInput.classList.add('hidden');
    } else {
        globalInput.classList.remove('hidden');
    }

    if (document.getElementById('sidebar').classList.contains('open')) toggleSidebar();
}

window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
}

onAuthStateChanged(auth, async (user) => {
    setTimeout(async () => {
        if (user) {
            try {
                const docSnap = await getDoc(doc(db, "users", user.uid));
                if (docSnap.exists()) {
                    updateUIWithUser(docSnap.data());
                    showAppScreen('screen-dashboard');
                } else {
                    showAppScreen('screen-setup');
                }
            } catch (e) {
                console.error("Firestore read error:", e);
                showAppScreen('screen-dashboard');
            }
        } else {
            showAppScreen('screen-auth');
        }
    }, 1200);
});

window.toggleAuth = function(type) {
    if (type === 'login') {
        document.getElementById('form-login').classList.remove('hidden');
        document.getElementById('form-signup').classList.add('hidden');
    } else {
        document.getElementById('form-login').classList.add('hidden');
        document.getElementById('form-signup').classList.remove('hidden');
    }
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
    } catch (error) { alert("Login failed: " + error.message); }
});

document.getElementById('form-signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await createUserWithEmailAndPassword(auth, document.getElementById('signup-email').value, document.getElementById('signup-password').value);
    } catch (error) { alert("Signup failed: " + error.message); }
});

document.getElementById('form-setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    const data = {
        fullName: document.getElementById('setup-name').value,
        goal: document.getElementById('setup-goal').value,
        onboardingComplete: true
    };
    try {
        await setDoc(doc(db, "users", user.uid), data);
        updateUIWithUser(data);
        showAppScreen('screen-dashboard');
    } catch (error) { alert("Error saving profile: " + error.message); }
});

window.logoutUser = function() {
    signOut(auth);
    if(document.getElementById('sidebar').classList.contains('open')) toggleSidebar();
}

function updateUIWithUser(data) {
    if(!data || !data.fullName) return;
    userState.fullName = data.fullName;
    userState.name = data.fullName.split(' ')[0];
    document.getElementById('greeting-name').innerText = userState.name;
    document.getElementById('nav-user-name').innerText = userState.name;
    document.getElementById('profile-name-display').innerText = userState.fullName;
}

// Calls our Node.js Server Proxy Endpoint (/api/chat) -> Solves CORS & Mobile Blocking completely!
async function callServerAI(promptText, modelType) {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText, modelType: modelType })
        });
        const data = await response.json();
        return data.reply;
    } catch (err) {
        console.error("Server API Call Error:", err);
        return "Ultron is re-establishing neural link. Please try again in a moment.";
    }
}

function formatHTML(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
}

window.handleGlobalSubmit = async function() {
    const inputEl = document.getElementById('chat-input');
    const text = inputEl.value.trim();
    if (!text) return;

    if (!document.getElementById('view-chat').classList.contains('active')) {
        navTo('view-chat', userState.context === 'HW Solver' ? 'HW Solver' : 'Socratic Tutor');
    }
    
    appendMessage('user', text);
    inputEl.value = '';
    const thinkingId = appendMessage('ai', "Ultron thinking...");

    let modelType = userState.context === "HW Solver" ? "solver" : "tutor";
    const reply = await callServerAI(text, modelType);
    
    document.getElementById(thinkingId).innerHTML = formatHTML(reply);
    addXP(15);
}

document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.activeElement.id === 'chat-input') {
        handleGlobalSubmit();
    }
});

function appendMessage(sender, text) {
    const container = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    const id = 'msg-' + Date.now();
    msgDiv.className = `message ${sender}-message`;
    
    if (sender === 'user') {
        msgDiv.innerHTML = `<div class="bubble">${text}</div>`;
    } else {
        msgDiv.innerHTML = `<div class="avatar-small"><div class="gradient-star">✦</div></div><div class="bubble" id="${id}">${text}</div>`;
    }
    
    container.appendChild(msgDiv);
    const mainContent = document.querySelector('.main-content');
    mainContent.scrollTo(0, mainContent.scrollHeight);
    return id;
}

function addXP(amount) {
    userState.xp += amount;
    const xpStr = `${userState.xp.toLocaleString()} XP`;
    ['nav-user-xp', 'xp-home-display', 'profile-xp-display'].forEach(el => {
        const domEl = document.getElementById(el);
        if (domEl) domEl.innerText = xpStr;
    });
}

let focusTimer;
window.startFocusTimer = function() {
    let timeLeft = 25 * 60;
    const display = document.getElementById('focus-time');
    clearInterval(focusTimer);
    focusTimer = setInterval(() => {
        timeLeft--;
        let m = Math.floor(timeLeft / 60);
        let s = timeLeft % 60;
        display.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        if (timeLeft <= 0) {
            clearInterval(focusTimer);
            display.innerText = "Done!";
            alert("Focus session complete! +50 XP");
            addXP(50);
        }
    }, 1000);
}

window.generateNotes = async function() {
    const topic = document.getElementById('notes-topic').value.trim();
    if (!topic) return alert("Please enter a topic.");
    const output = document.getElementById('notes-output');
    output.classList.remove('hidden');
    output.innerHTML = `<div class="text-center text-accent"><i class="fa-solid fa-spinner fa-spin text-2xl"></i><p class="mt-10">Extracting notes...</p></div>`;
    
    const reply = await callServerAI(`Summarize this topic into revision notes: ${topic}`, 'tutor');
    output.innerHTML = reply ? formatHTML(reply) : "Generation failed.";
    addXP(25);
}
