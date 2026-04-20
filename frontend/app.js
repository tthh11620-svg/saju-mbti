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

const STRUCTURE_LABEL_MAP = {
  '관성 강세형': { label: '기준 중심형', desc: '규칙·책임·외부 기준을 강하게 받아들이는 구조', mbti: 'T + J 방향 강세' },
  '식상 약세형': { label: '표현 내향형', desc: '생각·감정을 안에서 정리하고 천천히 꺼내는 구조', mbti: '즉흥 표현보다 내면 처리가 먼저' },
  '식상 발산형': { label: '표현 발산형', desc: '생각과 감정을 즉각 밖으로 꺼내는 구조', mbti: 'E + P 방향 강세' },
  '충돌 내면형': { label: '내면 긴장형', desc: '겉은 조용해도 내부에서 생각·감정이 자주 부딪히는 구조', mbti: '내면 갈등이 많은 NF·NT 패턴' },
  '해석 중심형': { label: '의미 탐색형', desc: '이면의 뜻·심리·패턴을 먼저 읽으려는 구조', mbti: 'N 우세 — 정보를 안에서 오래 굴리는 타입' },
  '환경 민감형': { label: '주변 흡수형', desc: '주변 분위기·사람 영향을 쉽게 받는 구조', mbti: 'F + 외부 자극 민감 — 공감 폭이 넓은 편' },
  '인성 강세형': { label: '수용 분석형', desc: '정보를 깊이 받아들이고 내면에서 오래 정리하는 구조', mbti: 'N + I 방향 강세' },
  '비견 강세형': { label: '자기주도형', desc: '독립성과 자기 기준이 강한 구조', mbti: 'E + T 방향 강세' },
  '책임 구조형': { label: '책임 우선형', desc: '신뢰와 책임감을 관계의 핵심으로 두는 구조', mbti: 'J + T 방향 강세' },
  '관계 민감형': { label: '관계 감지형', desc: '사람과 상황의 감정 흐름을 빠르게 읽는 구조', mbti: 'F + N 방향 강세' },
  '내면 축적형': { label: '내면 축적형', desc: '표현보다 안에서 쌓고 정리하는 구조', mbti: 'I + J 방향 강세' },
};
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
  E: {
    summary: "에너지가 외부 활동과 표현 쪽으로 흐르는 구조",
    desc: "말하고 행동하면서 정리되는 편. 자극이 있을 때 에너지가 살아남",
    bullets: ["생각보다 말이 먼저 나오는 편", "사람이 많은 공간에서 오히려 활력이 생김"],
    saju: "비겁·식상·화(火) 기운이 바깥으로 향하는 구조에서 읽힘",
  },
  I: {
    summary: "표현보다 내부 정리가 먼저 작동하는 구조",
    desc: "말하기 전에 안에서 먼저 정리하는 패턴. 혼자 있는 시간이 충전에 가까움",
    bullets: ["속으로 다 정리한 뒤 말이 나오는 편", "긴 자극 후엔 혼자만의 시간이 필요"],
    saju: "비겁 에너지가 안으로 수렴하거나 식상이 약한 구조에서 자주 나타남",
  },
  N: {
    summary: "현실 디테일보다 의미·흐름·가능성을 먼저 묶는 구조",
    desc: "눈앞 사실보다 이면의 패턴과 연결을 먼저 읽으려 함. '왜?'가 먼저 켜지는 타입",
    bullets: ["구체적인 것보다 맥락과 흐름이 먼저 눈에 들어옴", "새로운 가능성과 의미 연결을 즐기는 편"],
    saju: "수(水)·목(木)·식상 기운과 해석 중심 구조에서 읽힘",
  },
  S: {
    summary: "가능성보다 지금 현실과 조건을 먼저 확인하는 구조",
    desc: "패턴보다 실제 경험과 구체적 사실이 판단의 기준. 현실 감각이 발달해 있음",
    bullets: ["추상보다 구체적 방법과 현실이 먼저", "검증된 방식을 신뢰하는 편"],
    saju: "토(土)·금(金)·관성 기운이 강해 현실 기반 판단 구조가 만들어짐",
  },
  T: {
    summary: "감정보다 기준·논리·일관성이 판단의 중심인 구조",
    desc: "공감은 하지만 결국 판단은 기준과 일관성 쪽에서 이뤄짐. 원칙이 감정보다 먼저 정렬되는 편",
    bullets: ["앞뒤가 맞는지를 먼저 체크하는 편", "감정적 호소보다 근거 있는 설명이 더 설득력 있게 들림"],
    saju: "금(金)·관성·토(土) 기운이 객관적 분석과 기준 설정 쪽으로 작동하는 구조",
  },
  F: {
    summary: "감정선과 관계 맥락을 실제 판단 기준에 넣는 구조",
    desc: "논리만으로 결론 내리기 전에 상황 속 사람과 온도를 함께 고려하는 편",
    bullets: ["맞는 말이어도 전달 방식이 중요하게 느껴짐", "관계의 분위기와 감정 흐름을 자연스럽게 읽는 편"],
    saju: "수(水)·식상·목(木) 기운이 감정 감지와 관계 중심 판단으로 이어지는 구조",
  },
  J: {
    summary: "내부 기준과 정리 욕구가 비교적 강한 구조",
    desc: "결정을 미루는 것보다 정리된 상태를 선호. 계획이나 틀이 있을 때 더 잘 움직이는 편",
    bullets: ["마무리 안 된 상황이 오래 남아 있으면 신경 쓰이는 편", "즉흥보다 미리 준비하는 쪽이 편함"],
    saju: "토(土)·금(金)·관성·인성 기운이 체계와 기준 유지로 연결되는 구조",
  },
  P: {
    summary: "결정보다 가능성을 열어두고 흐름에 맞게 조율하는 구조",
    desc: "하나로 결론 내리기보다 다양한 방향을 탐색하며 움직이는 편. 유연성이 강점",
    bullets: ["정해진 계획보다 상황에 맞게 조절하는 방식이 편함", "마감 직전에 오히려 집중력이 올라오기도 함"],
    saju: "수(水)·비겁·식상·충(沖) 기운이 즉흥성과 유동적 구조를 만들어냄",
  },
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

  renderShareCard(data);
  renderMbtiResult(data);
  renderPersonalityCards(data);
  renderInterpretationBlocks(data);
  renderPostCTA(data);
  renderSajuDetails(data);
}

// ── 0. 공유 카드 ─────────────────────────────
function renderShareCard(data) {
  const mbti      = data.mbti?.type      || "----";
  const secondary = data.mbti?.secondary || "";
  const summary   = data.interpretation_blocks?.summary || "";
  const confidence = data.mbti?.confidence || {};

  document.getElementById("share-type").textContent = mbti;

  // 어떤 축에서 인접한지 표시
  const axisDiff = (() => {
    if (!mbti || mbti.length !== 4 || !secondary || secondary.length !== 4) return "";
    const axisLabels = ["E/I","N/S","T/F","J/P"];
    for (let i = 0; i < 4; i++) {
      if (mbti[i] !== secondary[i]) return axisLabels[i];
    }
    return "";
  })();
  document.getElementById("share-secondary").innerHTML = secondary
    ? `경계 유형 <strong>${escapeHtml(secondary)}</strong>${axisDiff ? `<br><span style="font-size:9px;opacity:.7">${axisDiff} 근소차</span>` : ""}`
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
    if (eiResult === 'I') promptEl.textContent = '설문은 E인데 사주 구조는 I — 친구도 읽어봐 👇';
    else if (eiResult === 'E') promptEl.textContent = '설문은 I인데 사주 구조는 E — 친구도 읽어봐 👇';
    else promptEl.textContent = '설문 MBTI랑 사주 구조가 다르게 읽힐 수 있어요 👀';
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
    const text = `내 사주 구조를 MBTI로 번역하면 ${mbti}${secondary ? ` (경계: ${secondary})` : ""}래. 너도 해봐 👇`;
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
        ${(() => {
          const h = AXIS_HINTS[info.result];
          if (!h) return '';
          return `
            <div class="axis-hint">${escapeHtml(h.summary)}</div>
            <div class="axis-hint axis-hint--desc">${escapeHtml(h.desc)}</div>
          `;
        })()}

        <div class="axis-strength-bar">
          <div class="axis-strength-bar__fill" style="width:${fillWidth}%"></div>
        </div>

        ${(() => {
          const h = AXIS_HINTS[info.result];
          const staticBullets = h?.bullets || [];
          const apiBullets = reasons;
          const bullets = apiBullets.length ? apiBullets : staticBullets;
          return bullets.length
            ? `<ul class="axis-reasons">
                ${bullets.map(r => `<li>${escapeHtml(r)}</li>`).join("")}
              </ul>`
            : '';
        })()}

        ${(() => {
          const h = AXIS_HINTS[info.result];
          return h?.saju
            ? `<div class="axis-saju-note">🔮 ${escapeHtml(h.saju)}</div>`
            : '';
        })()}
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

  // 구조 배지 렌더
  const structureBadges = structureLabels.length
    ? `<div class="struct-badge-row">
        ${structureLabels.map(raw => {
          const t = STRUCTURE_LABEL_MAP[raw];
          return t
            ? `<span class="struct-badge" title="${escapeHtml(t.desc)} · ${escapeHtml(t.mbti)}">
                 <span class="struct-badge__main">${escapeHtml(t.label)}</span>
                 <span class="struct-badge__sub">${escapeHtml(raw)}</span>
               </span>`
            : `<span class="struct-badge"><span class="struct-badge__main">${escapeHtml(raw)}</span></span>`;
        }).join("")}
      </div>`
    : '';

  // reason_summary 번역 병기
  const reasonHtml = (blocks.reason_summary || '').split('/').map(seg => {
    const s = seg.trim();
    const t = STRUCTURE_LABEL_MAP[s];
    return t
      ? `<span class="reason-term">${escapeHtml(t.label)}<span class="reason-term__orig">(${escapeHtml(s)})</span></span>`
      : escapeHtml(s);
  }).join(' / ');

  box.innerHTML = `
    <!-- ① 사주 구조 — 왜 이 유형인지 먼저 -->
    <div class="result-block result-block--saju-first">
      <div class="result-block__label">🔮 사주 구조로 보면</div>
      <div class="result-block__content result-block__content--small">${reasonHtml}</div>
      ${structureBadges}
    </div>

    <!-- ② 한 줄 요약 -->
    <div class="result-block">
      <div class="result-block__label">💡 한 줄로 정리하면</div>
      <div class="result-block__content" style="font-size:var(--text-base);font-weight:600;line-height:1.7;">${escapeHtml(blocks.summary || '')}</div>
    </div>

    <!-- ③ 이런 사람이에요 -->
    <div class="result-block">
      <div class="result-block__label">🌟 이런 사람이에요</div>
      ${renderSentenceLines(blocks.personality || '')}
    </div>

    <!-- ④ 조심할 부분 -->
    <div class="result-block">
      <div class="result-block__label">⚠️ 이건 조심하면 좋아요</div>
      ${renderSentenceLines(blocks.caution || '')}
    </div>

    <!-- ⑤ 연애·관계 -->
    <div class="result-block result-block--bordered">
      <div class="result-block__label">💬 연애·관계에선 이래요</div>
      ${renderSentenceLines(blocks.relationship || '')}
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
      <div class="section-eyebrow">🔗 가까워질수록 드러나는 이 사람의 구조</div>

      <div style="display:grid;grid-template-columns:1fr;gap:20px;">

        <div class="rel-card">
          <div class="rel-card__title">연애에서 드러나는 사주 패턴</div>
          ${renderSentenceLines(relation.love || '')}
        </div>

        <div class="rel-card">
          <div class="rel-card__title">가까워질수록 나오는 본래 구조</div>
          ${renderSentenceLines(relation.relationship || '')}
        </div>

        <div class="rel-card rel-card--compat">
          <div class="rel-card__title">이 구조가 편안함을 느끼기 쉬운 관계 타입</div>
          <div class="rel-card__compat-row">
            <span class="rel-card__compat-badge">${escapeHtml(compat)}</span>
            <span class="rel-card__compat-note">사주 구조 기반 참고 — 절대적 궁합이 아니에요</span>
          </div>
          ${renderSentenceLines(relation.compat_desc || '')}
        </div>

      </div>
    </div>
  `;
}

function renderPostCTA(data) {
  const section = document.getElementById("post-cta-section");
  if (!section) return;

  const confidence = data.mbti?.confidence || {};
  const labels = data.interpretation_blocks?.structure_labels || [];
  const has = l => labels.includes(l);

  const eiResult  = confidence['E/I']?.result  || '';
  const eiLabel   = confidence['E/I']?.label   || '';
  const jpResult  = confidence['J/P']?.result  || '';
  const jpLabel   = confidence['J/P']?.label   || '';
  const tfLabel   = confidence['T/F']?.label   || '';

  // 카드 1: 호감 표현 — I + 식상 약세형
  const card1Tag  = eiResult === 'I'
    ? `${eiLabel === 'clear' ? 'I 뚜렷' : 'I 우세'}${has('식상 약세형') ? ' + 표현 내향형' : ''}`
    : `E/I 경계`;
  const card1Desc = eiResult === 'I'
    ? `[${card1Tag}] 구조라서 — 이 결과에 이유가 있어요`
    : `[${card1Tag}] 구조에서 표현 타이밍이 엇나가는 패턴이 나와요`;

  // 카드 2: 가까워진 뒤 선 긋기 — J + 관성/충돌
  const card2Struct = has('관성 강세형') ? '기준 중심형' : has('충돌 내면형') ? '내면 긴장형' : '';
  const card2Tag  = jpResult === 'J'
    ? `${jpLabel === 'clear' ? 'J 뚜렷' : 'J 우세'}${card2Struct ? ` + ${card2Struct}` : ''}`
    : card2Struct || 'J/P 경계';
  const card2Desc = `[${card2Tag}] 구조가 만드는 관계 패턴 — 위에 있어요`;

  // 카드 4 (준비 중): T/F 경계 + 관성/식상 약세
  const card4Struct = has('관성 강세형') ? '기준 중심형' : has('식상 약세형') ? '표현 내향형' : '';
  const card4Desc = (tfLabel === 'balanced' || tfLabel === 'close') && card4Struct
    ? `[T/F 경계 + ${card4Struct}] 구조에서 자주 나오는 패턴이에요 — 곧 풀어드릴게요`
    : `의도와 다르게 읽히는 이유를 사주로 — 곧 열려요`;

  section.innerHTML = `
    <div class="card">
      <div class="section-eyebrow">🔍 이 결과에서 파생된 질문들</div>

      <div class="next-grid">

        <div class="next-card next-card--open" id="next-love">
          <span class="next-badge next-badge--included">결과에 있음 ↑</span>
          <span class="next-card__icon">💘</span>
          <div class="next-card__title">호감인데 왜 표현이 이상하게 나올까</div>
          <div class="next-card__desc">${escapeHtml(card1Desc)}</div>
        </div>

        <div class="next-card next-card--open" id="next-relation">
          <span class="next-badge next-badge--included">결과에 있음 ↑</span>
          <span class="next-card__icon">🥶</span>
          <div class="next-card__title">가까워진 뒤 왜 더 선 긋는 사람처럼 보일까</div>
          <div class="next-card__desc">${escapeHtml(card2Desc)}</div>
        </div>

        <div class="next-card next-card--soon">
          <span class="next-badge next-badge--soon">준비 중</span>
          <span class="next-card__icon">🔮</span>
          <div class="next-card__title">이 구조가 끌리는 타입 vs 오래 가는 타입</div>
          <div class="next-card__desc">보완 궁합과 케미 분석을 사주 구조로 — 곧 열려요</div>
        </div>

        <div class="next-card next-card--soon">
          <span class="next-badge next-badge--soon">준비 중</span>
          <span class="next-card__icon">🤔</span>
          <div class="next-card__title">배려했는데 왜 차갑게 읽히는 걸까</div>
          <div class="next-card__desc">${escapeHtml(card4Desc)}</div>
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