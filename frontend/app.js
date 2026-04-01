import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const API_BASE = "";

// 일간 설명 데이터
const DAY_MASTER_INFO = {
  '甲': { name: '갑목(甲木) — 큰 나무', desc: '하늘을 향해 곧게 뻗는 대목(大木)의 기운이에요. 목표를 향한 추진력과 리더십이 강하고, 한번 마음먹으면 쉽게 꺾이지 않는 타입 🌳' },
  '乙': { name: '을목(乙木) — 덩굴 식물', desc: '바람에 흔들려도 끊어지지 않는 유연한 초목의 기운이에요. 부드럽지만 끈질기고, 사람 사이를 자연스럽게 이어주는 매력이 있어요 🌿' },
  '丙': { name: '병화(丙火) — 태양', desc: '온 세상을 밝히는 태양의 기운이에요. 에너지가 넘치고 어디서든 존재감이 빛나며, 주변 사람들에게 활력을 불어넣는 타입 ☀️' },
  '丁': { name: '정화(丁火) — 촛불', desc: '어둠 속에서 은은하게 빛나는 불꽃의 기운이에요. 섬세하고 감성적이며, 가까운 사람에게는 누구보다 따뜻한 존재예요 🕯️' },
  '戊': { name: '무토(戊土) — 큰 산', desc: '묵직하게 자리를 지키는 대산(大山)의 기운이에요. 안정감과 포용력이 있고, 주변 사람들의 든든한 버팀목이 되어주는 타입 🏔️' },
  '己': { name: '기토(己土) — 논밭', desc: '만물을 키워내는 비옥한 대지의 기운이에요. 세심하고 배려심이 깊으며, 조용하지만 모든 걸 품어내는 힘이 있어요 🌾' },
  '庚': { name: '경금(庚金) — 원석', desc: '제련되기를 기다리는 강한 금속의 기운이에요. 원칙과 기준이 분명하고, 도전과 자극을 통해 더욱 빛나는 타입 ⚔️' },
  '辛': { name: '신금(辛金) — 보석', desc: '이미 갈고닦인 정교한 보석의 기운이에요. 예민하고 완벽주의적이며, 아름다움과 품격에 대한 감각이 남다른 타입 💎' },
  '壬': { name: '임수(壬水) — 큰 강', desc: '드넓게 흘러가는 대하(大河)의 기운이에요. 지혜롭고 포용력이 크며, 막힌 곳을 돌아가는 유연한 사고방식을 가진 타입 🌊' },
  '癸': { name: '계수(癸水) — 빗물', desc: '대지를 촉촉이 적시는 빗물과 이슬의 기운이에요. 감수성이 풍부하고 직관력이 뛰어나며, 깊은 내면의 세계를 가진 타입 💧' },
};

const ELEM_NAME = { '목': '木 목', '화': '火 화', '토': '土 토', '금': '金 금', '수': '水 수' };
const ELEM_COLOR = { '목': '#4caf50', '화': '#f44336', '토': '#ff9800', '금': '#9e9e9e', '수': '#2196f3' };
const PILLAR_ELEM = {
  '甲':'목','乙':'목','丙':'화','丁':'화','戊':'토','己':'토','庚':'금','辛':'금','壬':'수','癸':'수',
  '子':'수','丑':'토','寅':'목','卯':'목','辰':'토','巳':'화','午':'화','未':'토','申':'금','酉':'금','戌':'토','亥':'수',
};

const form          = document.getElementById("saju-form");
const calendarType  = document.getElementById("calendar-type");
const leapMonthRow  = document.getElementById("leap-month-row");
const loadingEl     = document.getElementById("loading");
const resultSection = document.getElementById("result-section");
const errorBox      = document.getElementById("error-box");

calendarType.addEventListener("change", () => {
  leapMonthRow.style.display = calendarType.value === "1" ? "flex" : "none";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearResult();
  showLoading(true);

  const payload = {
    year:     parseInt(document.getElementById("year").value),
    month:    parseInt(document.getElementById("month").value),
    day:      parseInt(document.getElementById("day").value),
    hour:     parseInt(document.getElementById("hour").value),
    minute:   parseInt(document.getElementById("minute").value),
    gender:   document.getElementById("gender").value,
    is_lunar: calendarType.value === "1",
    is_leap_month: document.getElementById("leap-month")?.checked ?? false,
    mode:     "combined",
  };

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      let msg = `서버 오류 (${res.status})`;
      try { msg = JSON.parse(text).error || JSON.parse(text).detail || msg; } catch {}
      throw new Error(msg + (text ? `: ${text.slice(0, 200)}` : ""));
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
  renderPart1(data);
  renderPart2(data);
  document.getElementById("interpretation").innerHTML = markdownToHtml(data.interpretation || "");
}

// ── 파트 1: 사주 원국 ──
function renderPart1(data) {
  const pillars = data.pillars || {};
  const dm = data.day_master || "";
  const dmInfo = DAY_MASTER_INFO[dm] || { name: dm, desc: "" };

  // 타이틀
  document.getElementById("part1-title").textContent = `${dm}일간 — ${dmInfo.name.split('—')[1]?.trim() || ''}`;
  document.getElementById("part1-subtitle").textContent = "당신의 사주 원국을 한눈에 확인해보세요 👇";

  // 기둥 4개
  const keys = [['pillar-year','년주'],['pillar-month','월주'],['pillar-day','일주'],['pillar-hour','시주']];
  const elemIds = ['pillar-year-elem','pillar-month-elem','pillar-day-elem','pillar-hour-elem'];
  keys.forEach(([id, key], i) => {
    const val = pillars[key] || "-";
    document.getElementById(id).textContent = val;
    if (val.length === 2) {
      const e1 = PILLAR_ELEM[val[0]], e2 = PILLAR_ELEM[val[1]];
      document.getElementById(elemIds[i]).textContent = `${e1 || ''}·${e2 || ''}`;
    }
  });

  // 일간 박스
  document.getElementById("dm-char").textContent = dm;
  document.getElementById("dm-name").textContent = dmInfo.name;
  document.getElementById("dm-desc").textContent = dmInfo.desc;

  // 오행 분포
  renderFiveElements(data.five_elements, data.five_elements_status);
}

function renderFiveElements(counts, status) {
  const container = document.getElementById("five-elements");
  if (!container || !counts) return;
  container.innerHTML = "";
  const maxCount = Math.max(...Object.values(counts), 1);
  for (const [elem, count] of Object.entries(counts)) {
    const pct = Math.round((count / maxCount) * 100);
    container.insertAdjacentHTML("beforeend", `
      <div class="elem-row">
        <span class="elem-name">${ELEM_NAME[elem] || elem}</span>
        <div class="elem-bar-wrap">
          <div class="elem-bar" style="width:${pct}%; background:${ELEM_COLOR[elem] || '#999'}"></div>
        </div>
        <span class="elem-count">${count}개 (${status?.[elem] || ""})</span>
      </div>
    `);
  }
}

// ── 파트 2: MBTI 축별 (각기 다른 레이아웃) ──
function renderPart2(data) {
  const mbti = data.mbti?.type || "----";
  const conf = data.mbti?.confidence || {};

  document.getElementById("mbti-badge").textContent = mbti;
  document.getElementById("mbti-hero-desc").innerHTML =
    `<strong>추정 유형: ${mbti}</strong><br>오행과 십성의 흐름이 당신의 행동 패턴을 말해줍니다.`;

  const container = document.getElementById("axis-cards");
  container.innerHTML = "";

  const axes = [
    { key: "E/I",  a: "E", b: "I",  aName: "외향형", bName: "내향형",  style: "bar",    icon: "⚡" },
    { key: "N/S",  a: "N", b: "S",  aName: "직관형", bName: "감각형",  style: "versus", icon: "🔭" },
    { key: "T/F",  a: "T", b: "F",  aName: "사고형", bName: "감정형",  style: "scale",  icon: "⚖️" },
    { key: "J/P",  a: "J", b: "P",  aName: "판단형", bName: "인식형",  style: "bar",    icon: "🗓️" },
  ];

  for (const axis of axes) {
    const info = conf[axis.key] || { result: "?", ratio: 50 };
    const winner = info.result;
    const ratio  = info.ratio;
    const loser  = (100 - ratio).toFixed(1);
    const isAWin = winner === axis.a;
    const aRatio = isAWin ? ratio : loser;
    const bRatio = isAWin ? loser  : ratio;
    const winName = isAWin ? axis.aName : axis.bName;

    let html = "";

    if (axis.style === "bar") {
      // E/I, J/P — 큰 슬라이더 바
      html = `
        <div class="axis-card">
          <div class="axis-title">
            ${axis.icon} ${axis.key} 축
            <span class="axis-winner-badge">${winner} ${winName}</span>
          </div>
          <div class="axis-subtitle">${axis.a}(${axis.aName}) ${aRatio}% &nbsp;vs&nbsp; ${axis.b}(${axis.bName}) ${bRatio}%</div>
          <div class="big-bar-wrap">
            <div class="big-bar-fill" style="width:${aRatio}%">
              <span>${aRatio}%</span>
            </div>
          </div>
          <div class="bar-labels">
            <span class="bar-label-left">${axis.a} ${axis.aName}</span>
            <span class="bar-label-right">${axis.b} ${axis.bName}</span>
          </div>
        </div>`;

    } else if (axis.style === "versus") {
      // N/S — 좌우 카드 대비
      html = `
        <div class="axis-card">
          <div class="axis-title">
            ${axis.icon} ${axis.key} 축
            <span class="axis-winner-badge">${winner} ${winName}</span>
          </div>
          <div class="axis-subtitle">정보를 어떻게 받아들이나요?</div>
          <div class="versus-wrap">
            <div class="versus-side ${isAWin ? 'active' : 'inactive'}">
              <div class="vs-letter">${axis.a}</div>
              <div class="vs-name">${axis.aName}</div>
              <div class="vs-pct">${aRatio}%</div>
            </div>
            <div class="versus-divider">vs</div>
            <div class="versus-side ${!isAWin ? 'active' : 'inactive'}">
              <div class="vs-letter">${axis.b}</div>
              <div class="vs-name">${axis.bName}</div>
              <div class="vs-pct">${bRatio}%</div>
            </div>
          </div>
        </div>`;

    } else if (axis.style === "scale") {
      // T/F — 저울 카드
      html = `
        <div class="axis-card">
          <div class="axis-title">
            ${axis.icon} ${axis.key} 축
            <span class="axis-winner-badge">${winner} ${winName}</span>
          </div>
          <div class="axis-subtitle">무엇을 기준으로 판단하나요?</div>
          <div class="scale-wrap">
            <div class="scale-side ${isAWin ? 'active' : 'inactive'}">
              <div class="scale-letter">${axis.a}</div>
              <div class="scale-name">${axis.aName}</div>
              <div class="scale-pct">${aRatio}%</div>
            </div>
            <div class="scale-side ${!isAWin ? 'active' : 'inactive'}">
              <div class="scale-letter">${axis.b}</div>
              <div class="scale-name">${axis.bName}</div>
              <div class="scale-pct">${bRatio}%</div>
            </div>
          </div>
        </div>`;
    }

    container.insertAdjacentHTML("beforeend", html);
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
        year: payload.year, month: payload.month, day: payload.day,
        hour: payload.hour, minute: payload.minute,
        gender: payload.gender, is_lunar: payload.is_lunar,
      },
      mbti_type: data.mbti?.type || null,
      mbti_confidence: data.mbti?.confidence || null,
      pillars: data.pillars,
      day_master: data.day_master,
      five_elements: data.five_elements,
      interpretation_preview: (data.interpretation || "").slice(0, 500),
    });
  } catch (err) {
    console.warn("Firestore 저장 실패:", err.message);
  }
}

// ──────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────
function showLoading(on) { loadingEl.style.display = on ? "flex" : "none"; }
function clearResult() {
  resultSection.style.display = "none";
  errorBox.style.display = "none";
  errorBox.textContent = "";
}
function showError(msg) {
  errorBox.style.display = "block";
  errorBox.textContent = `오류: ${msg}`;
}

function markdownToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(?!<[hup])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}
