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
        ignoreElements: el => el.id === "save-img-btn" || el.id === "share-result-btn",
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

function renderInterpretationBlocks(data) {
  const box = document.getElementById("interpretation");
  if (!box) return;

  const blocks = data.interpretation_blocks || {};
  const mbti = data.mbti?.type || '-';
  const secondary = data.mbti?.secondary || '-';
  const structureLabels = blocks.structure_labels || [];

  box.innerHTML = `
    <div class="result-block">
      <div class="result-block__label">사주 MBTI / 인접 유형</div>
      <div class="result-block__content">
        <span class="type-pill">${escapeHtml(mbti)}</span>
        <span class="type-pill type-pill--dim">${escapeHtml(secondary)}</span>
      </div>
    </div>

    ${
      structureLabels.length
        ? `<div class="result-block">
            <div class="result-block__label">이 사람 키워드</div>
            <div class="result-block__content">
              ${structureLabels.map(label => `
                <span style="display:inline-block;background:var(--surface-2);color:var(--text-primary);border-radius:999px;padding:6px 14px;font-size:0.8125rem;font-weight:800;margin:0 8px 8px 0;">
                  ${escapeHtml(label)}
                </span>
              `).join("")}
            </div>
          </div>`
        : ''
    }

    <div class="result-block">
      <div class="result-block__label">한 줄로 정리하면</div>
      <div class="result-block__content">${escapeHtml(blocks.summary || '')}</div>
    </div>

    <div class="result-block">
      <div class="result-block__label">이런 사람이에요</div>
      <div class="result-block__content">${escapeHtml(blocks.personality || '')}</div>
    </div>

    <div class="result-block">
      <div class="result-block__label">연애·관계에선 이래요</div>
      <div class="result-block__content">${escapeHtml(blocks.relationship || '')}</div>
    </div>

    <div class="result-block">
      <div class="result-block__label">이건 조심하면 좋아요</div>
      <div class="result-block__content">${escapeHtml(blocks.caution || '')}</div>
    </div>

    <div class="result-block result-block--bordered">
      <div class="result-block__label">왜 이렇게 나왔냐면</div>
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
      <div class="section-eyebrow">💝 관계에서 드러나는 나</div>

      <div style="display:grid;grid-template-columns:1fr;gap:14px;">
        <div style="border:1px solid var(--border);border-radius:16px;padding:18px;background:var(--surface-2);">
          <div style="font-size:1.125rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;">연애할 때</div>
          <div style="font-size:0.9375rem;line-height:1.85;color:var(--text-primary);">
            ${escapeHtml(relation.love || '')}
          </div>
        </div>

        <div style="border:1px solid var(--border);border-radius:16px;padding:18px;background:var(--surface-2);">
          <div style="font-size:1.125rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;">관계에서</div>
          <div style="font-size:0.9375rem;line-height:1.85;color:var(--text-primary);">
            ${escapeHtml(relation.relationship || '')}
          </div>
        </div>

        <div style="border:1px solid var(--border);border-radius:16px;padding:18px;background:var(--surface-2);">
          <div style="font-size:1.125rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;">보완 궁합</div>
          <div style="display:inline-block;background:var(--text-primary);color:var(--surface-1);border-radius:999px;padding:7px 12px;font-weight:700;margin-bottom:10px;">
            ${escapeHtml(compat)}
          </div>
          <div style="font-size:0.9375rem;line-height:1.85;color:var(--text-primary);">
            ${escapeHtml(relation.compat_desc || '')}
          </div>
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
      <div class="section-eyebrow">이것도 궁금하지 않나요?</div>

      <div class="next-grid">

        <div class="next-card next-card--open" id="next-love">
          <span class="next-badge next-badge--included">결과에 포함</span>
          <span class="next-card__arrow">↑</span>
          <span class="next-card__icon">💘</span>
          <div class="next-card__title">나는 연애할 때 어떤 타입?</div>
          <div class="next-card__desc">연애 패턴과 보완 궁합 유형이 결과 안에 있어요. 다시 올려볼게요.</div>
        </div>

        <div class="next-card next-card--open" id="next-relation">
          <span class="next-badge next-badge--included">결과에 포함</span>
          <span class="next-card__arrow">↑</span>
          <span class="next-card__icon">👥</span>
          <div class="next-card__title">친해지면 왜 이런 모습이 나올까?</div>
          <div class="next-card__desc">해석 블록에 관계 패턴이 담겨 있어요. 다시 올려볼게요.</div>
        </div>

        <div class="next-card next-card--soon">
          <span class="next-badge next-badge--soon">준비 중</span>
          <span class="next-card__icon">🔮</span>
          <div class="next-card__title">나랑 잘 맞는 유형은 누구?</div>
          <div class="next-card__desc">단순 궁합이 아니라 사주 구조로 보는 케미 분석이 곧 열려요.</div>
        </div>

        <div class="next-card next-card--soon">
          <span class="next-badge next-badge--soon">준비 중</span>
          <span class="next-card__icon">😤</span>
          <div class="next-card__title">대인관계에서 내가 오해받는 이유</div>
          <div class="next-card__desc">의도와 다르게 보이는 상황, 왜 생기는지 사주로 읽어드릴게요.</div>
        </div>

      </div>

      <div class="next-reanalyze">
        <span class="next-reanalyze__text">다른 사람 결과도 궁금하다면?</span>
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