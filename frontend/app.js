// ──────────────────────────────────────────────────────────
// Firebase 초기화
// ──────────────────────────────────────────────────────────
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);

// ──────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────
// 로컬 개발 → localhost, 배포 환경 → Render 서버 URL 자동 전환
// Cloudflare Pages Functions는 상대경로로 자동 연결됨
const API_BASE = "";

// ──────────────────────────────────────────────────────────
// DOM 요소
// ──────────────────────────────────────────────────────────
const form = document.getElementById("saju-form");
const calendarType = document.getElementById("calendar-type");
const leapMonthRow = document.getElementById("leap-month-row");
const loadingEl = document.getElementById("loading");
const resultSection = document.getElementById("result-section");
const errorBox = document.getElementById("error-box");

// ──────────────────────────────────────────────────────────
// 음력 선택 시 윤달 옵션 표시
// ──────────────────────────────────────────────────────────
calendarType.addEventListener("change", () => {
  leapMonthRow.style.display = calendarType.value === "1" ? "flex" : "none";
});

// ──────────────────────────────────────────────────────────
// 폼 제출
// ──────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearResult();
  showLoading(true);

  const payload = {
    year: parseInt(document.getElementById("year").value),
    month: parseInt(document.getElementById("month").value),
    day: parseInt(document.getElementById("day").value),
    hour: parseInt(document.getElementById("hour").value),
    minute: parseInt(document.getElementById("minute").value),
    gender: document.getElementById("gender").value,
    is_lunar: calendarType.value === "1",
    is_leap_month: document.getElementById("leap-month")?.checked ?? false,
    mode: document.getElementById("mode").value,
  };

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `서버 오류 (${res.status})`);
    }

    const data = await res.json();
    renderResult(data);
    await saveToFirestore(data, payload);
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
});

// ──────────────────────────────────────────────────────────
// 결과 렌더링
// ──────────────────────────────────────────────────────────
function renderResult(data) {
  resultSection.style.display = "block";
  resultSection.scrollIntoView({ behavior: "smooth" });

  // 사주 원국 카드
  const pillars = data.pillars;
  document.getElementById("pillar-year").textContent = pillars["년주"] || "-";
  document.getElementById("pillar-month").textContent = pillars["월주"] || "-";
  document.getElementById("pillar-day").textContent = pillars["일주"] || "-";
  document.getElementById("pillar-hour").textContent = pillars["시주"] || "-";

  // MBTI 배지
  document.getElementById("mbti-badge").textContent = data.mbti?.type || "-";

  // MBTI 확신도 바
  const confidence = data.mbti?.confidence || {};
  renderConfidenceBars(confidence);

  // GPT 해석 (마크다운 → HTML)
  const interpretEl = document.getElementById("interpretation");
  interpretEl.innerHTML = markdownToHtml(data.interpretation || "");

  // 오행 분포
  renderFiveElements(data.five_elements, data.five_elements_status);
}

function renderConfidenceBars(confidence) {
  const container = document.getElementById("confidence-bars");
  container.innerHTML = "";

  const labels = {
    "E/I": ["외향 E", "내향 I"],
    "N/S": ["직관 N", "감각 S"],
    "T/F": ["사고 T", "감정 F"],
    "J/P": ["판단 J", "인식 P"],
  };

  for (const [key, info] of Object.entries(confidence)) {
    const [a, b] = key.split("/");
    const winner = info.result;
    const ratio = info.ratio;
    const loserRatio = (100 - ratio).toFixed(1);
    const [labelA, labelB] = labels[key] || [a, b];

    const isAWinner = winner === a;
    const aRatio = isAWinner ? ratio : loserRatio;
    const bRatio = isAWinner ? loserRatio : ratio;

    container.insertAdjacentHTML("beforeend", `
      <div class="confidence-row">
        <span class="conf-label">${labelA}</span>
        <div class="conf-bar-wrap">
          <div class="conf-bar conf-a ${isAWinner ? "winner" : ""}" style="width:${aRatio}%">
            <span>${aRatio}%</span>
          </div>
          <div class="conf-bar conf-b ${!isAWinner ? "winner" : ""}" style="width:${bRatio}%">
            <span>${bRatio}%</span>
          </div>
        </div>
        <span class="conf-label">${labelB}</span>
      </div>
    `);
  }
}

function renderFiveElements(counts, status) {
  const container = document.getElementById("five-elements");
  if (!container || !counts) return;
  container.innerHTML = "";

  const nameMap = { "목": "木 목", "화": "火 화", "토": "土 토", "금": "金 금", "수": "水 수" };
  const colorMap = { "목": "#4caf50", "화": "#f44336", "토": "#ff9800", "금": "#9e9e9e", "수": "#2196f3" };
  const maxCount = Math.max(...Object.values(counts), 1);

  for (const [elem, count] of Object.entries(counts)) {
    const pct = Math.round((count / maxCount) * 100);
    container.insertAdjacentHTML("beforeend", `
      <div class="elem-row">
        <span class="elem-name">${nameMap[elem] || elem}</span>
        <div class="elem-bar-wrap">
          <div class="elem-bar" style="width:${pct}%; background:${colorMap[elem] || '#999'}"></div>
        </div>
        <span class="elem-count">${count}개 (${status?.[elem] || ""})</span>
      </div>
    `);
  }
}

// ──────────────────────────────────────────────────────────
// Firebase Firestore 저장
// ──────────────────────────────────────────────────────────
async function saveToFirestore(data, payload) {
  try {
    await addDoc(collection(db, "saju_results"), {
      createdAt: serverTimestamp(),
      input: {
        year: payload.year,
        month: payload.month,
        day: payload.day,
        hour: payload.hour,
        minute: payload.minute,
        gender: payload.gender,
        is_lunar: payload.is_lunar,
        mode: payload.mode,
      },
      solar_date: data.solar_date,
      mbti_type: data.mbti?.type || null,
      mbti_confidence: data.mbti?.confidence || null,
      pillars: data.pillars,
      day_master: data.day_master,
      five_elements: data.five_elements,
      interpretation_preview: (data.interpretation || "").slice(0, 500),
    });
    console.log("Firestore 저장 완료");
  } catch (err) {
    // Firestore 저장 실패는 사용자 UX에 영향 주지 않음
    console.warn("Firestore 저장 실패:", err.message);
  }
}

// ──────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────
function showLoading(on) {
  loadingEl.style.display = on ? "flex" : "none";
}

function clearResult() {
  resultSection.style.display = "none";
  errorBox.style.display = "none";
  errorBox.textContent = "";
}

function showError(msg) {
  errorBox.style.display = "block";
  errorBox.textContent = `오류: ${msg}`;
}

/** 최소한의 마크다운 → HTML 변환 (## h2, ### h3, **bold**, 줄바꿈) */
function markdownToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(?!<[hup])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}
