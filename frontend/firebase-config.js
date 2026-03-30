// Firebase CDN (모듈 방식) — 번들러 없이 브라우저에서 바로 사용
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZFOsdjIeVCxed3b7xbbNzdRovZ5_rvog",
  authDomain: "saju-706f1.firebaseapp.com",
  projectId: "saju-706f1",
  storageBucket: "saju-706f1.firebasestorage.app",
  messagingSenderId: "65090212273",
  appId: "1:65090212273:web:333e6b0fad1cd153deed90",
  measurementId: "G-0J3WTCH305"
};

export const app = initializeApp(firebaseConfig);
