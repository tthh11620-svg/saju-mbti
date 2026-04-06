import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const API_BASE = "";

// ── 일간 정보 (간결 표기) ──────────────────────────────────
const DAY_MASTER_INFO = {
  '甲': { name: '갑목(甲木)', desc: '곧게 밀고 나가는 추진력과 방향성이 강한 편' },
  '乙': { name: '을목(乙木)', desc: '유연하고 섬세하며 관계 흐름을 잘 읽는 편' },
  '丙': { name: '병화(丙火)', desc: '표현력과 바깥으로 드러나는 에너지가 비교적 강한 편' },
  '丁': { name: '정화(丁火)', desc: '섬세하고 집중력이 있으며 감정 온도를 세밀하게 다루는 편' },
  '戊': { name: '무토(戊土)', desc: '기준과 중심을 지키려는 힘이 크고 안정감이 있는 편' },
  '己': { name: '기토(己土)', desc: '현실감각이 좋고 세심하며 꾸준히 쌓아가는 편' },
  '庚': { name: '경금(庚金)', desc: '결단력과 직선성이 있으며 기준이 분명한 편' },
  '辛': { name: '신금(辛金)', desc: '정교하고 예민하며 완성도와 디테일을 중시하는 편' },
  '壬': { name: '임수(壬水)', desc: '유연하고 넓게 보며 변화 흐름을 읽는 편' },
  '癸': { name: '계수(癸水)', desc: '섬세하고 관찰력이 좋으며 내면 감수성이 깊은 편' },
};

const ELEM_NAME = { '목': '木 목', '화': '火 화', '토': '土 토', '금': '金 금', '수': '水 수' };
const PILLAR_ELEM = {
  '甲':'목','乙':'목','丙':'화','丁':'화','戊':'토','己':'토','庚':'금','辛':'금','壬':'수','癸':'수',
  '子':'수','丑':'토','寅':'목','卯':'목','辰':'토','巳':'화','午':'화','未':'토','申':'금','酉':'금','戌':'토','亥':'수',
};

// label → 시각 강도 바 너비
const LABEL_BAR_WIDTH = { balanced: 50, close: 62, lean: 75, clear: 88 };
// label → 배지 텍스트
const LABEL_TEXT = { balanced: '거의 비슷', close: '근소 우세', lean: '우세', clear: '뚜렷' };

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
    year:          parseInt(document.getElementById("year").value),
    month:         parseInt(document.getElementById("month").value),
    day:           parseInt(document.getElementById("day").value),
    hour:          parseInt(document.getElementById("hour").value),
    minute:        parseInt(document.getElementById("minute").value),
    gender:        document.getElementById("gender").value,
    is_lunar:      calendarType.value === "1",
    is_leap_month: document.getElementById("leap-month")?.checked ?? false,
    mode:          "combined",
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
      try {
        const parsed = JSON.parse(text);
        msg = parsed.error || parsed.detail || msg;
      } catch {}
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

// ─────────────────────────────────────────────────────────
// 결과 렌더링 순서: MBTI → 해석 블록 → 관계 카드 → 확장 카드 → CTA → 사주 상세
// ─────────────────────────────────────────────────────────
function renderResult(data) {
  resultSection.style.display = "block";
  resultSection.scrollIntoView({ behavior: "smooth" });

  renderMbtiHero(data);
  renderAxisCards(data);
  renderInterpretationBlocks(data);
  renderPersonalityCards(data);
  renderExtensionCards(data);
  renderPostCTA(data.mbti?.type || "");
  renderSajuDetails(data);
}

// ── 1. MBTI 히어로 배지 ────────────────────────────────────
function renderMbtiHero(data) {
  const mbti      = data.mbti?.type      || "----";
  const secondary = data.mbti?.secondary || "";

  document.getElementById("mbti-badge").textContent = mbti;

  const secHtml = secondary
    ? `<div class="mbti-hero__secondary">인접 유형 <strong>${escapeHtml(secondary)}</strong></div>`
    : "";

  document.getElementById("mbti-hero-desc").innerHTML = `
    <strong>타고난 유형 ${escapeHtml(mbti)}</strong>
    ${secHtml}
    <div class="mbti-hero__sub">사주 8자 구조가 말해주는 기질적 성향이에요</div>
  `;
}

// ── 2. 축별 카드 ──────────────────────────────────────────
function renderAxisCards(data) {
  const confidence = data.mbti?.confidence || {};
  const container  = document.getElementById("axis-cards");
  container.innerHTML = "";

  const axes = [
    { key: "E/I", icon: "⚡", title: "에너지 방향" },
    { key: "N/S", icon: "🔭", title: "정보 처리" },
    { key: "T/F", icon: "⚖️", title: "판단 기준" },
    { key: "J/P", icon: "🗓️", title: "생활 운영" },
  ];

  for (const axis of axes) {
    const info = confidence[axis.key];
    if (!info) continue;

    const labelText  = LABEL_TEXT[info.label]     || "근소 우세";
    const barWidth   = LABEL_BAR_WIDTH[info.label] || 60;
    const reasons    = (info.reasons || []).slice(0, 2);
    const isBalanced = info.label === "balanced";

    const reasonsHtml = reasons.length
      ? `<ul class="axis-reasons">${reasons.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
      : "";

    container.insertAdjacentHTML("beforeend", `
      <div class="axis-card">
        <div class="axis-header">
          <span class="axis-title">${axis.icon} ${axis.key} 축 <span class="axis-title__sub">${axis.title}</span></span>
          <span class="axis-badge ${isBalanced ? 'axis-badge--dim' : ''}">${labelText}</span>
        </div>
        <div class="axis-display">${escapeHtml(info.display || `${info.result} 우세`)}</div>
        <div class="axis-strength-bar">
          <div class="axis-strength-bar__fill" style="width:${barWidth}%"></div>
        </div>
        ${reasonsHtml}
      </div>
    `);
  }
}

// ── 3. 해석 블록 (이미 .card 안에 있으므로 외부 래핑 없음) ──
function renderInterpretationBlocks(data) {
  const box    = document.getElementById("interpretation");
  if (!box) return;

  const blocks    = data.interpretation_blocks || {};
  const mbti      = data.mbti?.type      || "-";
  const secondary = data.mbti?.secondary || "-";

  const items = [
    { label: "1순위 / 인접 유형",     text: `${mbti} / ${secondary}`,      strong: true },
    { label: "한줄 요약",             text: blocks.summary      || "" },
    { label: "성향 핵심",             text: blocks.personality  || "" },
    { label: "관계 · 연애 포인트",    text: blocks.relationship || "" },
    { label: "주의할 점",             text: blocks.caution      || "" },
    { label: "근거 요약",             text: blocks.reason_summary || "", small: true },
  ].filter(item => item.text);

  box.innerHTML = items.map((item, i) => `
    <div class="result-block ${i > 0 ? 'result-block--bordered' : ''}">
      <div class="result-block__label">${item.label}</div>
      <div class="result-block__content ${item.small ? 'result-block__content--small' : ''}">
        ${item.strong ? `<strong class="type-pill">${escapeHtml(mbti)}</strong> <span class="type-pill type-pill--dim">${escapeHtml(secondary)}</span>` : escapeHtml(item.text)}
      </div>
    </div>
  `).join("");
}

// ── 4. 관계 성향 카드 ─────────────────────────────────────
function renderPersonalityCards(data) {
  const section = document.getElementById("personality-section");
  if (!section) return;

  const relation = data.relationship_cards || {};
  const compat = relation.compatible_mbti || data.mbti?.secondary || "----";

  section.innerHTML = `
    <div class="card" style="background:#fff;border:1px solid #e8e8e8;border-radius:20px;padding:22px;box-shadow:0 4px 14px rgba(0,0,0,.04);">
      <div class="section-eyebrow" style="font-size:14px;color:#555;margin-bottom:12px;font-weight:700;">💝 관계에서 드러나는 나</div>

      <div style="display:grid;grid-template-columns:1fr;gap:14px;">
        <div style="border:1px solid #ececec;border-radius:16px;padding:18px;background:#fafafa;">
          <div style="font-size:16px;font-weight:800;color:#111;margin-bottom:10px;">연애할 때</div>
          <div style="font-size:15px;line-height:1.8;color:#222;">
            ${escapeHtml(relation.love || '')}
          </div>
        </div>

        <div style="border:1px solid #ececec;border-radius:16px;padding:18px;background:#fafafa;">
          <div style="font-size:16px;font-weight:800;color:#111;margin-bottom:10px;">관계에서</div>
          <div style="font-size:15px;line-height:1.8;color:#222;">
            ${escapeHtml(relation.relationship || '')}
          </div>
        </div>

        <div style="border:1px solid #ececec;border-radius:16px;padding:18px;background:#fafafa;">
          <div style="font-size:16px;font-weight:800;color:#111;margin-bottom:10px;">보완 궁합</div>
          <div style="display:inline-block;background:#111;color:#fff;border-radius:999px;padding:7px 12px;font-weight:700;margin-bottom:10px;">
            ${escapeHtml(compat)}
          </div>
          <div style="font-size:15px;line-height:1.8;color:#222;">
            ${escapeHtml(relation.compat_desc || '')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── 5. 확장 카드 (오픈 1개 + 잠금 3개) ────────────────────
function renderExtensionCards(data) {
  const section   = document.getElementById("extension-cards-section");
  if (!section) return;

  const mbti      = data.mbti?.type      || "----";
  const secondary = data.mbti?.secondary || "----";
  const confidence = data.mbti?.confidence || {};

  // 가장 박빙인 축 찾기
  let closestAxis = "", closestDisplay = "";
  let minGap = Infinity;
  for (const [key, info] of Object.entries(confidence)) {
    if (info.label === "balanced" || info.label === "close") {
      const scores = Object.values(info.scores || {});
      const gap = scores.length === 2 ? Math.abs(scores[0] - scores[1]) : Infinity;
      if (gap < minGap) { minGap = gap; closestAxis = key; closestDisplay = info.display || ""; }
    }
  }

  const openCardHtml = `
    <div class="ext-card ext-card--open">
      <div class="ext-card__icon">🔀</div>
      <div class="ext-card__title">겉 MBTI vs 타고난 MBTI</div>
      <div class="ext-card__desc">설문 결과와 사주 결과가 다를 수 있어요.</div>
      <div class="ext-card__preview">
        1순위 <strong>${escapeHtml(mbti)}</strong> · 인접 <strong>${escapeHtml(secondary)}</strong>
        ${closestAxis ? `<br>박빙 축: <em>${closestAxis}</em> — ${escapeHtml(closestDisplay)}` : ""}
      </div>
    </div>
  `;

  const lockedCards = [
    { icon: "💘", title: "연애 심화 분석", desc: "내 연애 패턴 깊게 보기" },
    { icon: "👥", title: "친구/동료와 내 모습", desc: "직장과 친구 사이에서 달라지는 나" },
    { icon: "⚡", title: "갈등 상황의 나", desc: "스트레스 받을 때 어떻게 반응하나요?" },
  ].map(c => `
    <div class="ext-card ext-card--locked">
      <span class="ext-card__lock">🔒</span>
      <div class="ext-card__icon">${c.icon}</div>
      <div class="ext-card__title">${c.title}</div>
      <div class="ext-card__desc">${c.desc}</div>
      <div class="ext-card__coming">준비 중이에요</div>
    </div>
  `).join("");

  section.innerHTML = `
    <div class="card">
      <div class="section-eyebrow">🧩 더 알아볼 수 있어요</div>
      <div class="ext-grid">
        ${openCardHtml}
        ${lockedCards}
      </div>
    </div>
  `;
}

// ── 6. 공유 / 다시하기 CTA ────────────────────────────────
function renderPostCTA(mbti) {
  const section = document.getElementById("post-cta-section");
  if (!section) return;

  section.innerHTML = `
    <div class="card">
      <div class="section-eyebrow">이것도 궁금하지 않나요?</div>
      <p class="cta-desc">결과가 흥미로우셨나요? 친구나 연인의 유형도 확인해보세요!</p>
      <div class="cta-row">
        <button class="cta-btn cta-btn--primary" id="share-btn">🔗 결과 공유하기</button>
        <button class="cta-btn" id="reanalyze-btn">🔄 다시 분석하기</button>
      </div>
    </div>
  `;

  document.getElementById("share-btn")?.addEventListener("click", () => {
    const text = `사주 기반으로 본 내 MBTI는 ${mbti}. 나도 해보려면 여기서 확인해봐 👇`;
    if (navigator.share) {
      navigator.share({ title: `내 사주 MBTI: ${mbti}`, text, url: location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${text} ${location.href}`)
        .then(() => alert("링크가 복사됐어요 😊"));
    }
  });

  document.getElementById("reanalyze-btn")?.addEventListener("click", () => {
    resultSection.style.display = "none";
    document.getElementById("saju-form").scrollIntoView({ behavior: "smooth" });
  });
}

// ── 7. 사주 원국 상세 (접기 영역) ─────────────────────────
function renderSajuDetails(data) {
  const pillars   = data.pillars || {};
  const dm        = data.day_master || "";
  const dmInfo    = DAY_MASTER_INFO[dm] || { name: dm, desc: "" };
  const structure = data.saju_structure || {};

  document.getElementById("part1-title").textContent    = dmInfo.name;
  document.getElementById("part1-subtitle").textContent = "사주 8자 구조는 MBTI 결과의 근거 자료입니다.";

  const pillarsMap = [
    ["pillar-year",  "년주"],
    ["pillar-month", "월주"],
    ["pillar-day",   "일주"],
    ["pillar-hour",  "시주"],
  ];
  const elemIds = ["pillar-year-elem","pillar-month-elem","pillar-day-elem","pillar-hour-elem"];

  pillarsMap.forEach(([id, key], i) => {
    const val = pillars[key] || "-";
    document.getElementById(id).textContent = val;
    document.getElementById(elemIds[i]).textContent =
      val.length === 2 ? `${PILLAR_ELEM[val[0]] || ""}·${PILLAR_ELEM[val[1]] || ""}` : "";
  });

  document.getElementById("dm-char").textContent = dm;
  document.getElementById("dm-name").textContent  = dmInfo.name;
  document.getElementById("dm-desc").textContent  =
    `${dmInfo.desc}${structure.dayMasterStrengthLabel ? ` / 일간 강도: ${structure.dayMasterStrengthLabel}` : ""}`;

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
          <div class="elem-bar" style="width:${pct}%"></div>
        </div>
        <span class="elem-count">${count}개 (${status?.[elem] || ""})</span>
      </div>
    `);
  }
}

// ─────────────────────────────────────────────────────────
// Firestore 저장
// ─────────────────────────────────────────────────────────
async function saveToFirestore(data, payload) {
  try {
    await addDoc(collection(db, "saju_results"), {
      createdAt: serverTimestamp(),
      input: {
        year: payload.year, month: payload.month, day: payload.day,
        hour: payload.hour, minute: payload.minute,
        gender: payload.gender, is_lunar: payload.is_lunar,
      },
      mbti_type:      data.mbti?.type      || null,
      mbti_secondary: data.mbti?.secondary || null,
      mbti_confidence: data.mbti?.confidence || null,
      pillars:         data.pillars,
      day_master:      data.day_master,
      five_elements:   data.five_elements,
      interpretation_preview: (data.interpretation_blocks?.summary || "").slice(0, 500),
    });
  } catch (err) {
    console.warn("Firestore 저장 실패:", err.message);
  }
}

// ─────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────
function showLoading(on)  { loadingEl.style.display = on ? "flex" : "none"; }

function clearResult() {
  resultSection.style.display = "none";
  errorBox.style.display      = "none";
  errorBox.textContent        = "";

  // 동적 생성 섹션 비우기
  ["personality-section", "extension-cards-section", "post-cta-section"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
}

function showError(msg) {
  errorBox.style.display = "block";
  errorBox.textContent   = `오류: ${msg}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
