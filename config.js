// ==========================================================================
// Ultron AI Tutor — App Config
// ==========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBgjd69-vB0YaErcAYHFuQ3-IgP5iMUUp4",
  authDomain: "ultron-ai-tutor.firebaseapp.com",
  projectId: "ultron-ai-tutor",
  storageBucket: "ultron-ai-tutor.firebasestorage.app",
  messagingSenderId: "1020040458194",
  appId: "1:1020040458194:web:36f57a13059c2fc154620b"
};

// Base URL for the Node backend (server.js). Change this if you deploy
// the API somewhere other than the same origin as the frontend.
const API_BASE_URL = window.location.origin;

const APP_CONFIG = {
  name: "Ultron AI Tutor",
  version: "0.1.0",
  dailyGoalMinutesDefault: 30,
  maxUploadFilesPerMessage: 5,
};

// Exposed as globals so firebase.js / script.js can use them without a
// bundler. If you move to a build step later, convert these to ES modules.
window.__ULTRON_FIREBASE_CONFIG__ = firebaseConfig;
window.__ULTRON_API_BASE_URL__ = API_BASE_URL;
window.__ULTRON_APP_CONFIG__ = APP_CONFIG;
