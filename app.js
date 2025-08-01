import {
  getDatabase,
  ref,
  set,
  onValue,
  get,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQQOzGiDgOFdrVT-8p-h4IjrodVj4Pn_s",
  authDomain: "quiz-game-e082c.firebaseapp.com",
  databaseURL:
    "https://quiz-game-e082c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "quiz-game-e082c",
  storageBucket: "quiz-game-e082c.firebasestorage.app",
  messagingSenderId: "753065970058",
  appId: "1:753065970058:web:e82ff03c74ff3833e7a073",
  measurementId: "G-KQE86J3RKS",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// Sign in anonymously
signInAnonymously(auth)
  .then(() => {
    console.log("Signed in anonymously");
  })
  .catch((error) => {
    console.error("Anonymous sign-in failed:", error);
  });

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    appState.playerId = user.uid;
  } else {
    console.log("User is signed out");
  }
});

export const appState = {
  gameState: "setup",
  isAdmin: false,
  sessionId: "",
  playerName: "",
  playerId: "",
  quizData: null,
  players: {},
  currentQuestionIndex: 0,
  selectedAnswer: null,
  hasAnswered: false,
  timeLeft: 60,
  timer: null,
  listeners: [],
  playerAnswers: {}, // Track individual player answers
  isQuizFinished: false,
};

// Utility functions
export function generateSessionId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function showScreen(screenId) {
  console.log("Switching to screen:", screenId);
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add("active");
  } else {
    console.error("Screen not found:", screenId);
  }
}

export function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
  }
}

export function hideError(elementId) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.classList.add("hidden");
  }
}

function pathRef(path) {
  return ref(db, path);
}

// Firebase data functions
export function writeData(path, data) {
  return new Promise((resolve, reject) => {
    set(pathRef(path), data)
      .then(() => resolve())
      .catch((error) => reject(error));
  });
}

export function readData(path) {
  return new Promise((resolve, reject) => {
    get(pathRef(path))
      .then((snapshot) => resolve(snapshot.val()))
      .catch((error) => reject(error));
  });
}

export function listenToData(path, callback) {
  const ref = pathRef(path);
  onValue(ref, (snapshot) => {
    callback(snapshot.val());
  });
  appState.listeners.push(() => ref.off());
}

// Sanitize section names for Firebase keys
export const sanitizeKey = (key) =>
  key
    .replace(/\./g, "_")
    .replace(/#/g, "_")
    .replace(/\$/g, "_")
    .replace(/\[/g, "_")
    .replace(/\]/g, "_")
    .replace(/\//g, "_")
    .replace(/^$/, "section");
