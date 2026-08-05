// ==========================================================================
// Ultron AI Tutor — Firebase Auth
// Uses the Firebase v10 modular SDK straight from the CDN (no bundler).
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = window.__ULTRON_FIREBASE_CONFIG__;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

/**
 * Creates a Firestore `users/{uid}` doc the first time we see a user.
 * Matches the collections listed in the blueprint: users, chats, notes,
 * planner, progress, flashcards, quizzes, uploads.
 */
async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
      dailyGoalMinutes: 30,
      streak: 0,
    });
  }
  return ref;
}

/** Email/password account creation ("Create account" flow). */
async function signUpWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  await ensureUserDoc(cred.user);
  return cred.user;
}

/** Email/password sign-in. */
async function signInWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(cred.user);
  return cred.user;
}

/** Google sign-in (also creates an account the first time it's used). */
async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(cred.user);
  return cred.user;
}

async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

async function signOutUser() {
  return signOut(auth);
}

/** Fires cb(user | null) on every auth state change, immediately included. */
function watchAuthState(cb) {
  return onAuthStateChanged(auth, cb);
}

/** Returns the current user's ID token, for calling the Node backend. */
async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

function mapAuthError(err) {
  const code = err?.code || "";
  const map = {
    "auth/email-already-in-use": "That email is already registered — try signing in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/too-many-requests": "Too many attempts — please wait a moment and try again.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

window.UltronAuth = {
  auth,
  db,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  resetPassword,
  signOutUser,
  watchAuthState,
  getIdToken,
  mapAuthError,
};
