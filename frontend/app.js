import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const API_BASE = "";

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

const AXIS_LABEL_TEXT = {
  balanced: '거의 비슷',
  close: '근소 우세',
  lean: '우세',
  clear: '뚜렷'
};

// 축별 행동 묘사형 힌트 (정의형 금지, 관찰형으로)
const AXIS_HINTS = {
  E: "사람들과 함께할 때 에너지가 올라오는 편. 말하면서 정리하는 타입",
  I: "속으로 정리한 뒤 말이 나오는 편. 혼자 있어야 충전됨",
  N: "현실보다 패턴과 가능성을 먼저 읽는 편. 디테일보다 맥락이 먼저",
  S: "가능성보다 지금 조건을 먼저 체크하는 편. 현실 감각이 판단 기준",
  T: "공감도 하지만 결국 기준과 논리가 판단의 중심에 있는 타입",
  F: "사람 사이 온도와 맥락을 실제 판단 기준에 넣는 편",
  J: "겉으론 유연해 보여도 속은 이미 정리 끝난 경우가 많음",
  P: "결정보다 가능성을 열어두고 흐름에 맞게 조율하는 편",
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

// 시간 입력 토글
const timeToggleBtn = document.getElementById("time-toggle-btn");
const timeFields    = document.getElementById("time-fields");
timeToggleBtn.addEventListener("click", () => {
  const isOpen = timeFields.classList.toggle("is-open");
  timeToggleBtn.classList.toggle("is-open", isOpen);
  timeToggleBtn.querySelector(".time-toggle-btn__arrow").style.transform = isOpen ? "rotate(180deg)" : "";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearResult();
  showLoading(true);

  const payload = {
    year:          parseInt(document.getElementById("year").value),
    month:         parseInt(document.getElementById("month").value),
    day:           parseInt(document.getElementById("day").value),
    hour:          parseInt(document.getElementById("hour").value) || 12,
    minute:        parseInt(document.getElementById("minute").value) || 0,
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

    // ── 일간 검증 로그 ─────────────────────────────────────
    // 일간(day master)은 반드시 일주의 천간(첫 글자)이어야 함
    const pillarDayMaster = data.pillars?.['일주']?.[0] ?? null;
    console.group('[사주MBTI] 사주 원국 검증');
    console.table({
      '년주': data.pillars?.['년주'],
      '월주': data.pillars?.['월주'],
      '일주': data.pillars?.['일주'],
      '시주': data.pillars?.['시주'],
    });
    console.log('API day_master       :', data.day_master);
    console.log('일주[0] 추출 일간    :', pillarDayMaster);
    console.log('일치 여부            :', data.day_master === pillarDayMaster ? '✅ 일치' : '❌ 불일치 — 일주 추출값으로 교정');
    console.log('eight_chars          :', data.eight_chars);
    console.groupEnd();

    // 불일치 시 일주 첫 글자를 일간으로 교정
    if (pillarDayMaster && data.day_master !== pillarDayMaster) {
      console.warn('[사주MBTI] day_master 교정:', data.day_master, '→', pillarDayMaster);
      data.day_master = pillarDayMaster;
    }
    // ───────────────────────────────────────────────────────

    // 1) 결과를 먼저 그린다
    try {
      renderResult(data);
    } catch (renderErr) {
      // 렌더링 중 예외가 나도 로딩은 무조건 끄고 에러 메시지로 전환
      console.error("렌더링 오류:", renderErr);
      throw new Error(`결과 렌더링 실패: ${renderErr.message}`);
    }

    // 2) 렌더링이 끝났으면 로딩을 즉시 종료한다.
    //    requestAnimationFrame으로 한 프레임 확실히 그린 뒤 끄기.
    showLoading(false);

    // 3) Firestore 저장은 fire-and-forget — 절대 사용자 흐름을 막지 않는다.
    //    내부에서 try/catch로 에러는 콘솔로만 전달.
    saveToFirestore(data, payload).catch(err => {
      console.warn("Firestore 저장 실패(무시):", err?.message || err);
    });

  } catch (err) {
    showError(err.message);
  } finally {
    // 안전망: 어떤 경로로 빠져나오든 로딩이 살아있으면 강제 종료
    showLoading(false);
  }
});

// ─────────────────────────────────────────────
// 결과 렌더링
// ─────────────────────────────────────────────
function renderResult(data) {
  resultSection.style.display = "block";
  resultSection.scrollIntoView({ behavior: "smooth" });

  renderQuickSummary(data);
  renderShareCard(data);
  renderMbtiResult(data);
  renderPersonalityCards(data);
  renderInterpretationBlocks(data);
  renderPostCTA(data.mbti?.type || "");
  renderSajuDetails(data);
}

// ── 0. 공유 카드 ─────────────────────────────
function renderShareCard(data) {
  const mbti      = data.mbti?.type      || "----";
  const secondary = data.mbti?.secondary || "";
  const summary   = data.interpretation_blocks?.summary || "";
  const confidence = data.mbti?.confidence || {};

  document.getElementById("share-type").textContent = mbti;

  document.getElementById("share-secondary").innerHTML = secondary
    ? `인접 유형 <strong>${escapeHtml(secondary)}</strong>`
    : "";

  document.getElementById("share-summary").textContent = summary;

  // 축 요약 4개
  const axesContainer = document.getElementById("share-axes");
  axesContainer.innerHTML = "";
  const axisNames = { E:"외향",I:"내향",N:"직관",S:"감각",T:"사고",F:"감정",J:"판단",P:"인식" };
  const axisKeys = ["E/I","N/S","T/F","J/P"];
  for (const key of axisKeys) {
    const info = confidence[key];
    if (!info) continue;
    const labelShort = { balanced:"비슷", close:"근소", lean:"우세", clear:"뚜렷" };
    axesContainer.insertAdjacentHTML("beforeend", `
      <div class="share-card__axis">
        <div class="share-card__axis-key">${key}</div>
        <div class="share-card__axis-result">${escapeHtml(info.result)}</div>
        <div class="share-card__axis-label">${axisNames[info.result] || ""} · ${labelShort[info.label] || ""}</div>
      </div>
    `);
  }

  // 공유 프롬프트 문구
  const eiResult = confidence['E/I']?.result;
  const promptEl = document.getElementById("share-prompt");
  if (promptEl) {
    if (eiResult === 'I') promptEl.textContent = '나는 E처럼 사는 I였다 — 친구도 확인해봐 👇';
    else if (eiResult === 'E') promptEl.textContent = '나는 I처럼 사는 E였다 — 친구도 확인해봐 👇';
    else promptEl.textContent = '겉보기 MBTI랑 태생 MBTI 차이 공유하기 👀';
  }

  // 이미지 저장
  document.getElementById("save-img-btn").onclick = async () => {
    const btn = document.getElementById("save-img-btn");
    btn.textContent = "저장 중…";
    btn.disabled = true;
    try {
      const canvas = await html2canvas(document.getElementById("share-card"), {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        ignoreElements: el => ["save-img-btn","share-result-btn","share-prompt"].includes(el.id),
      });
      const link = document.createElement("a");
      link.download = `사주MBTI_${mbti}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      alert("이미지 저장에 실패했어요. 스크린샷을 이용해주세요 😊");
    } finally {
      btn.textContent = "📸 이미지로 저장";
      btn.disabled = false;
    }
  };

  // 공유
  document.getElementById("share-result-btn").onclick = () => {
    const text = `사주로 본 내 타고난 MBTI는 ${mbti}${secondary ? ` (인접: ${secondary})` : ""}! 나도 해봐 👇`;
    if (navigator.share) {
      navigator.share({ title: `사주 MBTI: ${mbti}`, text, url: location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${text} ${location.href}`)
        .then(() => alert("링크가 복사됐어요 😊"));
    }
  };
}

function renderQuickSummary(data) {
  const el = document.getElementById("quick-summary");
  if (!el) return;

  const blocks = data.interpretation_blocks || {};
  const confidence = data.mbti?.confidence || {};
  const secondary = data.mbti?.secondary || "";
  const mbtiType = data.mbti?.type || "";

  // 가장 센 축 찾기
  const strength = { clear: 4, lean: 3, close: 2, balanced: 1 };
  let strongest = null;
  for (const [key, info] of Object.entries(confidence)) {
    if (!strongest || (strength[info.label] || 0) > (strength[strongest.label] || 0)) {
      strongest = { key, ...info };
    }
  }
  const labelKo = { clear: '뚜렷', lean: '우세', close: '근소', balanced: '비슷' };

  // 의외 포인트: caution 첫 문장
  const cautionfull = blocks.caution || '';
  const surprise = cautionfull.replace(/([.。])\s+/g, '$1\n').split('\n')[0].trim() || '—';

  el.innerHTML = `
    <div class="quick-summary">
      <div class="quick-summary__row">
        <span class="quick-summary__icon">💡</span>
        <span class="quick-summary__label">한 줄 요약</span>
        <span class="quick-summary__value">${escapeHtml(blocks.summary || '—')}</span>
      </div>
      <div class="quick-summary__row">
        <span class="quick-summary__icon">⚡</span>
        <span class="quick-summary__label">가장 센 축</span>
        <span class="quick-summary__value">
          ${strongest
            ? `<span class="qs-accent">${escapeHtml(strongest.key)}</span> &nbsp;${escapeHtml(strongest.display || strongest.result + ' 우세')} <span style="font-size:var(--text-xs);color:var(--text-muted);">(${labelKo[strongest.label] || ''})</span>`
            : '—'}
        </span>
      </div>
      <div class="quick-summary__row">
        <span class="quick-summary__icon">🤔</span>
        <span class="quick-summary__label">의외 포인트</span>
        <span class="quick-summary__value">${escapeHtml(surprise)}</span>
      </div>
      <div class="quick-summary__row">
        <span class="quick-summary__icon">🔀</span>
        <span class="quick-summary__label">인접 유형</span>
        <span class="quick-summary__value">
          ${secondary
            ? `<span class="qs-accent" style="font-size:var(--text-sm);">${escapeHtml(mbtiType)} ↔ ${escapeHtml(secondary)}</span>`
            : '해당 없음'}
        </span>
      </div>
    </div>
  `;
}

function renderMbtiResult(data) {
  const confidence = data.mbti?.confidence || {};

  const container = document.getElementById("axis-cards");
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

    const labelText = AXIS_LABEL_TEXT[info.label] || "근소 우세";
    const reasons = (info.reasons || []).slice(0, 2);

    const fillWidth = info.label === 'balanced' ? 40 : info.label === 'close' ? 55 : info.label === 'lean' ? 72 : 90;

    const html = `
      <div class="axis-card">
        <div class="axis-header">
          <div class="axis-title">
            ${axis.icon} ${axis.key}
            <span class="axis-title__sub">${axis.title}</span>
          </div>
          <span class="axis-badge ${info.label === 'balanced' ? 'axis-badge--dim' : ''}">
            ${labelText}
          </span>
        </div>

        <div class="axis-display">${escapeHtml(info.display || `${info.result} 우세`)}</div>
        ${AXIS_HINTS[info.result] ? `<div class="axis-hint">${AXIS_HINTS[info.result]}</div>` : ''}

        <div class="axis-strength-bar">
          <div class="axis-strength-bar__fill" style="width:${fillWidth}%"></div>
        </div>

        ${
          reasons.length
            ? `<ul class="axis-reasons">
                ${reasons.map(r => `<li>${escapeHtml(r)}</li>`).join("")}
              </ul>`
            : ""
        }
      </div>
    `;

    container.insertAdjacentHTML("beforeend", html);
  }
}

function renderSentenceLines(text) {
  if (!text) return `<div class="result-block__content"></div>`;
  const lines = text
    .replace(/([.。!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 3);
  if (lines.length <= 1) {
    return `<div class="result-block__content">${escapeHtml(text)}</div>`;
  }
  return `<div class="result-block__content sentence-lines">${
    lines.map(s => `<div class="sentence-line">${escapeHtml(s)}</div>`).join('')
  }</div>`;
}

function renderInterpretationBlocks(data) {
  const box = document.getElementById("interpretation");
  if (!box) return;

  const blocks = data.interpretation_blocks || {};
  const structureLabels = blocks.structure_labels || [];

  box.innerHTML = `
    <div class="result-block">
      <div class="result-block__label">💡 한 줄로 정리하면</div>
      <div class="result-block__content" style="font-size:var(--text-base);font-weight:600;line-height:1.7;">${escapeHtml(blocks.summary || '')}</div>
    </div>

    <div class="result-block">
      <div class="result-block__label">🌟 이런 사람이에요</div>
      ${renderSentenceLines(blocks.personality || '')}
      ${structureLabels.length ? `
        <div style="margin-top:var(--s4);display:flex;flex-wrap:wrap;gap:8px;">
          ${structureLabels.map(label => `
            <span style="display:inline-block;background:var(--surface-3);color:var(--text-primary);border-radius:999px;padding:5px 14px;font-size:0.8125rem;font-weight:800;">
              ${escapeHtml(label)}
            </span>
          `).join("")}
        </div>` : ''}
    </div>

    <div class="result-block">
      <div class="result-block__label">💬 연애·관계에선 이래요</div>
      ${renderSentenceLines(blocks.relationship || '')}
    </div>

    <div class="result-block">
      <div class="result-block__label">⚠️ 이건 조심하면 좋아요</div>
      ${renderSentenceLines(blocks.caution || '')}
    </div>

    <div class="result-block result-block--bordered">
      <div class="result-block__label">🔍 사주 구조로 보면</div>
      <div class="result-block__content result-block__content--small">${escapeHtml(blocks.reason_summary || '')}</div>
    </div>
  `;
}

function renderPersonalityCards(data) {
  const section = document.getElementById("personality-section");
  if (!section) return;

  const relation = data.relationship_cards || {};
  const compat = relation.compatible_mbti || data.mbti?.secondary || "----";

  section.innerHTML = `
    <div class="card">
      <div class="section-eyebrow">💝 관계 패턴 — 알아두면 편해요</div>

      <div style="display:grid;grid-template-columns:1fr;gap:20px;">

        <div style="border:1px solid var(--border);border-radius:16px;padding:20px;background:var(--surface-2);box-shadow:var(--shadow-sm);">
          <div style="font-size:1.125rem;font-weight:800;color:var(--text-primary);margin-bottom:14px;">💕 연애할 때</div>
          ${renderSentenceLines(relation.love || '')}
        </div>

        <div style="border:1px solid var(--border);border-radius:16px;padding:20px;background:var(--surface-2);box-shadow:var(--shadow-sm);">
          <div style="font-size:1.125rem;font-weight:800;color:var(--text-primary);margin-bottom:14px;">🤝 가까워지면</div>
          ${renderSentenceLines(relation.relationship || '')}
        </div>

        <div style="border:1px solid var(--border);border-radius:16px;padding:20px;background:var(--surface-2);box-shadow:var(--shadow-sm);">
          <div style="font-size:1.125rem;font-weight:800;color:var(--text-primary);margin-bottom:14px;">🔮 나한테 맞는 사람</div>
          <div style="margin-bottom:14px;">
            <span style="display:inline-block;background:var(--primary);color:#fff;border-radius:999px;padding:6px 16px;font-family:var(--font-display);font-weight:900;font-size:1rem;letter-spacing:2px;">${escapeHtml(compat)}</span>
            <span style="display:inline-block;margin-left:8px;font-size:var(--text-xs);color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;">보완 궁합</span>
          </div>
          ${renderSentenceLines(relation.compat_desc || '')}
        </div>

      </div>
    </div>
  `;
}

function renderPostCTA(_mbti) {
  const section = document.getElementById("post-cta-section");
  if (!section) return;

  section.innerHTML = `
    <div class="card">
      <div class="section-eyebrow">👀 더 찌르는 질문들</div>

      <div class="next-grid">

        <div class="next-card next-card--open" id="next-love">
          <span class="next-badge next-badge--included">결과에 있음 ↑</span>
          <span class="next-card__icon">💘</span>
          <div class="next-card__title">왜 호감 있어도 티가 이상하게 날까?</div>
          <div class="next-card__desc">연애 패턴이 위 결과에 담겨 있어요. 바로 올려볼게요.</div>
        </div>

        <div class="next-card next-card--open" id="next-relation">
          <span class="next-badge next-badge--included">결과에 있음 ↑</span>
          <span class="next-card__icon">🥶</span>
          <div class="next-card__title">친해지면 갑자기 차가워 보이는 이유</div>
          <div class="next-card__desc">관계 패턴 해석이 위에 있어요. 바로 올려볼게요.</div>
        </div>

        <div class="next-card next-card--soon">
          <span class="next-badge next-badge--soon">준비 중</span>
          <span class="next-card__icon">🔮</span>
          <div class="next-card__title">나한테 끌리는 사람 vs 오래 가는 사람</div>
          <div class="next-card__desc">사주 구조로 보는 케미 분석, 곧 열려요.</div>
        </div>

        <div class="next-card next-card--soon">
          <span class="next-badge next-badge--soon">준비 중</span>
          <span class="next-card__icon">🤔</span>
          <div class="next-card__title">배려했는데 왜 상대는 차갑다고 느낄까?</div>
          <div class="next-card__desc">의도랑 다르게 읽히는 이유, 사주로 풀어드릴게요.</div>
        </div>

      </div>

      <div class="next-reanalyze">
        <span class="next-reanalyze__text">친구 결과도 궁금하다면?</span>
        <button class="cta-btn" id="reanalyze-btn">🔄 다시 분석하기</button>
      </div>
    </div>
  `;

  document.getElementById("next-love")?.addEventListener("click", () => {
    document.getElementById("personality-section")?.scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("next-relation")?.addEventListener("click", () => {
    document.getElementById("interpretation")?.scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("reanalyze-btn")?.addEventListener("click", () => {
    resultSection.style.display = "none";
    document.getElementById("saju-form").scrollIntoView({ behavior: "smooth" });
  });
}

function renderSajuDetails(data) {
  const pillars = data.pillars || {};
  const dm = data.day_master || "";
  const dmInfo = DAY_MASTER_INFO[dm] || { name: dm, desc: "" };
  const structure = data.saju_structure || {};

  document.getElementById("part1-title").textContent = `${dmInfo.name}`;
  document.getElementById("part1-subtitle").textContent = "사주 원국과 오행 구조는 MBTI 결과를 뒷받침하는 참고 정보입니다.";

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
    if (val.length === 2) {
      const e1 = PILLAR_ELEM[val[0]], e2 = PILLAR_ELEM[val[1]];
      document.getElementById(elemIds[i]).textContent = `${e1 || ""}·${e2 || ""}`;
    } else {
      document.getElementById(elemIds[i]).textContent = '';
    }
  });

  document.getElementById("dm-char").textContent = dm;
  document.getElementById("dm-name").textContent = dmInfo.name;
  document.getElementById("dm-desc").textContent =
    `${dmInfo.desc}${structure.dayMasterStrengthLabel ? ` / 일간 강도: ${structure.dayMasterStrengthLabel}` : ''}`;

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

// ─────────────────────────────────────────────
// Firestore 저장
// ─────────────────────────────────────────────
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
      },
      mbti_type: data.mbti?.type || null,
      mbti_secondary: data.mbti?.secondary || null,
      mbti_confidence: data.mbti?.confidence || null,
      pillars: data.pillars,
      day_master: data.day_master,
      five_elements: data.five_elements,
      interpretation_preview: (data.interpretation_blocks?.summary || "").slice(0, 500),
    });
  } catch (err) {
    console.warn("Firestore 저장 실패:", err.message);
  }
}

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────
function showLoading(on) {
  if (!loadingEl) return;
  if (on) {
    loadingEl.style.display = "flex";
    loadingEl.setAttribute("aria-hidden", "false");
  } else {
    // requestAnimationFrame으로 마지막 프레임을 그린 뒤 확실히 숨김
    requestAnimationFrame(() => {
      loadingEl.style.display = "none";
      loadingEl.setAttribute("aria-hidden", "true");
    });
  }
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

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}