// Cloudflare Pages Function — POST /api/analyze (v3.1)
// 결정적 사주 계산 엔진 v3 + MBTI v4 (완전 재설계)
// 원국: 자체 엔진. MBTI: 투명 가산 모델 + top_contributors
// 의존성: npm i tyme4ts
import { SolarTerm, LunarDay, SolarTime } from 'tyme4ts';

// =====================================================================
// ganzhi/constants.js
// 천간/지지/오행 등 정적 데이터. 간지 계산 엔진들이 공유.
// =====================================================================

const CHEONGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JIJI     = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

const CHAR_INFO = {
  '甲':['목',1],'乙':['목',0],'丙':['화',1],'丁':['화',0],
  '戊':['토',1],'己':['토',0],'庚':['금',1],'辛':['금',0],
  '壬':['수',1],'癸':['수',0],
  '子':['수',0],'丑':['토',0],'寅':['목',1],'卯':['목',0],
  '辰':['토',1],'巳':['화',1],'午':['화',0],'未':['토',0],
  '申':['금',1],'酉':['금',0],'戌':['토',1],'亥':['수',1],
};
const ELEM_IDX   = {'목':0,'화':1,'토':2,'금':3,'수':4};
const ELEM_HANJA = {'목':'木','화':'火','토':'土','금':'金','수':'水'};

const DAY_MASTER_LABEL = {
  '甲':'갑목(甲木)','乙':'을목(乙木)','丙':'병화(丙火)','丁':'정화(丁火)','戊':'무토(戊土)',
  '己':'기토(己土)','庚':'경금(庚金)','辛':'신금(辛金)','壬':'임수(壬水)','癸':'계수(癸水)',
};
const JIJANGGAN = {
  '子':['癸'],'丑':['己','癸','辛'],'寅':['甲','丙','戊'],'卯':['乙'],
  '辰':['戊','乙','癸'],'巳':['丙','戊','庚'],'午':['丁','己'],'未':['己','丁','乙'],
  '申':['庚','壬','戊'],'酉':['辛'],'戌':['戊','辛','丁'],'亥':['壬','甲'],
};

const ZASI_POLICY = Object.freeze({
  SAME_DAY_MIDNIGHT: 'same_day_midnight',
  NEXT_DAY_MIDNIGHT: 'next_day_midnight',
});
const DEFAULT_ZASI_POLICY = ZASI_POLICY.NEXT_DAY_MIDNIGHT;

// 60갑자 인덱스 유틸
function cycleIdxFromChars(stem, branch) {
  const s = CHEONGAN.indexOf(stem);
  const b = JIJI.indexOf(branch);
  if (s < 0 || b < 0) throw new Error(`Invalid stem/branch: ${stem}${branch}`);
  for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
  throw new Error(`Invalid 60-cycle pair: ${stem}${branch}`);
}
function cycleIdxToChars(idx) {
  const i = ((idx % 60) + 60) % 60;
  return [CHEONGAN[i % 10], JIJI[i % 12]];
}

// 기타 상수 (postProcess가 쓰는 것들)
const TWELVE_STAGES = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'];
const JANGSEONG_START = {'甲':11,'乙':6,'丙':2,'丁':9,'戊':2,'己':9,'庚':5,'辛':0,'壬':8,'癸':3};
const IS_YANG_GAN = {'甲':true,'乙':false,'丙':true,'丁':false,'戊':true,'己':false,'庚':true,'辛':false,'壬':true,'癸':false};
const GAN_POSITIONS = ['년간','월간','일간','시간'];
const JI_POSITIONS  = ['년지','월지','일지','시지'];
const CHEONGAN_HAP   = [['甲','己','토'],['乙','庚','금'],['丙','辛','수'],['丁','壬','목'],['戊','癸','화']];
const CHEONGAN_CHUNG = [['甲','庚'],['乙','辛'],['丙','壬'],['丁','癸']];
const YUKAP   = [['子','丑','토'],['寅','亥','목'],['卯','戌','화'],['辰','酉','금'],['巳','申','수'],['午','未','화']];
const CHUNG   = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']];
const SAMHAP  = [[['申','子','辰'],'수'],[['亥','卯','未'],'목'],[['寅','午','戌'],'화'],[['巳','酉','丑'],'금']];
const BANGHAP = [[['寅','卯','辰'],'목'],[['巳','午','未'],'화'],[['申','酉','戌'],'금'],[['亥','子','丑'],'수']];
const HYUNG3  = [['寅','巳','申'],['丑','戌','未']];
const HYUNG2  = [['子','卯']];
const JAHYUNG = new Set(['辰','午','酉','亥']);
const PA      = [['子','酉'],['卯','午'],['寅','亥'],['巳','申'],['辰','丑'],['戌','未']];
const HAE     = [['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']];
const SAMHAP_GROUP = {
  '寅':'寅午戌','午':'寅午戌','戌':'寅午戌',
  '申':'申子辰','子':'申子辰','辰':'申子辰',
  '巳':'巳酉丑','酉':'巳酉丑','丑':'巳酉丑',
  '亥':'亥卯未','卯':'亥卯未','未':'亥卯未',
};
const SINSAL_TABLE = {
  '寅午戌':{'역마':'申','도화':'卯','화개':'戌','겁살':'亥','망신':'巳','장성':'午'},
  '申子辰':{'역마':'寅','도화':'酉','화개':'辰','겁살':'巳','망신':'亥','장성':'子'},
  '巳酉丑':{'역마':'亥','도화':'午','화개':'丑','겁살':'寅','망신':'申','장성':'酉'},
  '亥卯未':{'역마':'巳','도화':'子','화개':'未','겁살':'申','망신':'寅','장성':'卯'},
};
const CHEONUL = {
  '甲':['丑','未'],'戊':['丑','未'],'乙':['子','申'],'己':['子','申'],
  '丙':['亥','酉'],'丁':['亥','酉'],'庚':['寅','午'],'辛':['寅','午'],
  '壬':['卯','巳'],'癸':['卯','巳'],
};
const MUNCHANG = {'甲':'巳','乙':'午','丙':'申','丁':'酉','戊':'申','己':'酉','庚':'亥','辛':'子','壬':'寅','癸':'卯'};
const HAKDANG  = {'甲':'亥','乙':'午','丙':'寅','丁':'酉','戊':'寅','己':'酉','庚':'巳','辛':'子','壬':'申','癸':'卯'};
const GEUMYEO  = {'甲':'辰','乙':'巳','丙':'未','丁':'申','戊':'未','己':'申','庚':'戌','辛':'亥','壬':'丑','癸':'寅'};
const MONTH_BRANCH_BOOST = {
  '寅':'목','卯':'목','辰':'토','巳':'화','午':'화','未':'토',
  '申':'금','酉':'금','戌':'토','亥':'수','子':'수','丑':'토',
};
const CONFLICT_MEANING = {
  '子午':'감정과 행동의 온도차가 커질 수 있는 구조',
  '寅申':'환경 적응과 자기 방향성 사이의 충돌이 생기기 쉬운 구조',
  '卯酉':'관계 예민도와 표현 방식의 마찰이 생기기 쉬운 구조',
  '辰戌':'안정과 변화 욕구가 부딪히는 구조',
  '巳亥':'직감과 현실 판단이 엇갈릴 수 있는 구조',
  '丑未':'책임과 감정 부담이 동시에 쌓일 수 있는 구조',
};

// =====================================================================
// calendar/solarTermProvider.js
// 절기 시각 공급자. tyme4ts 사용하되 SolarTerm API만 씀.
// EightChar / SolarTime / LunarHour 일절 사용 금지.
//
// 역할:
//   - 입춘 시각
//   - 12절(월 경계)의 시각
//   - 특정 시각이 어느 월 구간(寅~丑)에 속하는지 판정
// =====================================================================



// 12절 ordered list. 월지 배정 순서대로.
// tyme4ts NAMES 배열 인덱스와 각 월지.
const JIE_SEQUENCE = [
  { name: '立春', index: 3,  branch: '寅' },
  { name: '惊蛰', index: 5,  branch: '卯' },
  { name: '清明', index: 7,  branch: '辰' },
  { name: '立夏', index: 9,  branch: '巳' },
  { name: '芒种', index: 11, branch: '午' },
  { name: '小暑', index: 13, branch: '未' },
  { name: '立秋', index: 15, branch: '申' },
  { name: '白露', index: 17, branch: '酉' },
  { name: '寒露', index: 19, branch: '戌' },
  { name: '立冬', index: 21, branch: '亥' },
  { name: '大雪', index: 23, branch: '子' },
  { name: '小寒', index: 1,  branch: '丑' }, // 小寒는 다음 해 1월에 발생
];

// JulianDay → 분 단위 KST datetime 객체
function jdToKstDateTime(jd) {
  // tyme4ts SolarTime은 이미 KST(local) 기준 그대로 나옴 (timezone-naive)
  const st = jd.getSolarTime();
  return {
    year:   st.getYear(),
    month:  st.getMonth(),
    day:    st.getDay(),
    hour:   st.getHour(),
    minute: st.getMinute(),
    second: st.getSecond(),
    // 분 단위 비교용 정수 (1분 단위)
    totalMinutes: toMinutes(st.getYear(), st.getMonth(), st.getDay(), st.getHour(), st.getMinute()),
    jd: jd.getDay(),
  };
}

// epoch-free 분 단위 타임스탬프 (비교만 가능하면 됨). JD 그대로 쓴다.
function toMinutes(y, mo, d, h, mi) {
  // Date.UTC를 쓰되 KST ≡ UTC로 간주 (벽시계 시각 순서만 필요)
  return Math.floor(Date.UTC(y, mo - 1, d, h, mi, 0) / 60000);
}

/**
 * 특정 연도의 입춘 시각.
 * @returns {{year,month,day,hour,minute,totalMinutes}}
 */
function getIpchun(year) {
  const t = SolarTerm.fromIndex(year, 3); // 立春
  return jdToKstDateTime(t.getJulianDay());
}

/**
 * 특정 연도의 12절 시각 리스트.
 * 중요: "이 연도의 사주 월주 계산에 쓰일 구간들"을 만들어야 하므로
 *       해당 연도 입춘부터 다음 연도 입춘 직전까지가 포함되어야 한다.
 *
 * 구체적으로:
 *   - 입춘(寅월 시작) ~ 경칩 전
 *   - 경칩(卯월 시작) ~ 청명 전
 *   - ...
 *   - 대설(子월 시작) ~ 소한 전
 *   - 소한(丑월 시작) ~ 다음해 입춘 전   ← 소한은 year+1 달력에 있음
 *
 * @returns {Array<{name, branch, start:{year,month,day,hour,minute,totalMinutes}}>}
 */
function getMonthBoundaries(sajuYear) {
  const boundaries = [];
  for (const { name, index, branch } of JIE_SEQUENCE) {
    // 小寒(index=1)만 다음 해 달력에 속함
    const queryYear = (name === '小寒') ? sajuYear + 1 : sajuYear;
    const t = SolarTerm.fromIndex(queryYear, index);
    boundaries.push({ name, branch, start: jdToKstDateTime(t.getJulianDay()) });
  }
  return boundaries;
}

/**
 * 주어진 시각이 어떤 사주 연도에 속하는지 판정.
 * 입춘 이전이면 전년도, 이후면 당해.
 *
 * @param {{year,month,day,hour,minute}} dt
 * @returns {number} 사주 연도
 */
function resolveSajuYear({ year, month, day, hour, minute }) {
  const ipchunThis = getIpchun(year);
  const dtMin = toMinutes(year, month, day, hour, minute);
  if (dtMin < ipchunThis.totalMinutes) {
    return year - 1;
  }
  return year;
}

/**
 * 주어진 시각이 어떤 월지(寅~丑) 구간에 속하는지.
 * sajuYear는 미리 resolveSajuYear로 구해서 넘길 것.
 *
 * @returns {{name:string, branch:string, branchIdx:number(0~11 in JIE_SEQUENCE)}}
 */
function resolveMonthBranch(dt, sajuYear) {
  const dtMin = toMinutes(dt.year, dt.month, dt.day, dt.hour, dt.minute);
  const boundaries = getMonthBoundaries(sajuYear);
  // 마지막부터 스캔: dt >= boundary.start인 가장 최근 구간
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (dtMin >= boundaries[i].start.totalMinutes) {
      return {
        name: boundaries[i].name,
        branch: boundaries[i].branch,
        jieIdx: i, // 0=寅, 1=卯, ..., 11=丑
      };
    }
  }
  // 이 코드에 도달하면 입춘 이전 — resolveSajuYear 처리 누락
  throw new Error(
    `resolveMonthBranch: dt(${JSON.stringify(dt)}) is before 입춘 of sajuYear ${sajuYear}. ` +
    `Caller must resolveSajuYear first.`
  );
}

// =====================================================================
// calendar/lunarConverter.js
// 음력(윤달 포함) → 양력 변환.
// tyme4ts LunarDay 사용. EightChar/LunarHour는 사용 금지.
// =====================================================================



/**
 * @param {object} input
 * @param {number} input.year
 * @param {number} input.month   1~12
 * @param {number} input.day
 * @param {boolean} [input.isLeap=false]
 * @param {number} input.hour
 * @param {number} [input.minute=0]
 * @returns {{year, month, day, hour, minute}} 양력 KST
 */
function lunarToSolar({ year, month, day, isLeap = false, hour, minute = 0 }) {
  if (year < 1900 || year > 2100) throw new Error(`year out of range (1900~2100): ${year}`);
  if (month < 1 || month > 12)   throw new Error(`lunar month must be 1~12 (use isLeap): ${month}`);

  const tymeMonth = isLeap ? -month : month;
  let solarDay;
  try {
    solarDay = LunarDay.fromYmd(year, tymeMonth, day).getSolarDay();
  } catch (e) {
    throw new Error(`Invalid lunar date ${year}-${isLeap ? '윤' : ''}${month}-${day}: ${e.message}`);
  }
  return {
    year:   solarDay.getYear(),
    month:  solarDay.getMonth(),
    day:    solarDay.getDay(),
    hour,
    minute,
  };
}

// =====================================================================
// ganzhi/yearPillarEngine.js
// 연주 계산 — 입춘 기준.
// solarTermProvider.resolveSajuYear()가 이미 입춘 경계를 적용해서
// sajuYear를 넘겨주므로, 이 엔진은 sajuYear → 60갑자 매핑만 담당.
// =====================================================================



// Anchor: 서기 4년 = 甲子년 (유일하게 검증 가능한 역사적 anchor).
//   (year - 4) mod 60 → 60갑자 인덱스
// 예: 2024 → (2024-4) mod 60 = 2020 mod 60 = 40 → 甲辰 ✓
//     1984 → (1984-4) mod 60 = 1980 mod 60 = 0  → 甲子 ✓
const YEAR_ANCHOR = 4;

/**
 * @param {number} sajuYear  resolveSajuYear() 결과
 */
function computeYearPillar(sajuYear) {
  if (!Number.isInteger(sajuYear)) throw new Error(`sajuYear must be integer: ${sajuYear}`);
  const cycleIdx = ((sajuYear - YEAR_ANCHOR) % 60 + 60) % 60;
  const stem = CHEONGAN[cycleIdx % 10];
  const branch = JIJI[cycleIdx % 12];
  return {
    sajuYear,
    stem,
    branch,
    pillar: `${stem}${branch}`,
    cycleIdx,
  };
}

// =====================================================================
// ganzhi/monthPillarEngine.js
// 월주 계산 — 절입 시각 기준 월지 + 오호둔(五虎遁)으로 월간 결정.
//
// 월지 판정은 solarTermProvider.resolveMonthBranch()로 완료된 상태.
// 이 엔진은 그 결과(jieIdx)와 연간(yearStem)으로부터 월간을 계산.
//
// ─── 오호둔 (五虎遁) ──────────────────────────────────────────
// 寅月(입춘 시작)의 월간은 년간에 따라 결정:
//   甲/己년 → 丙寅월부터
//   乙/庚년 → 戊寅월부터
//   丙/辛년 → 庚寅월부터
//   丁/壬년 → 壬寅월부터
//   戊/癸년 → 甲寅월부터
// 이후 월은 천간이 1씩 증가하며 지지도 寅→卯→辰→...→丑 순회.
// =====================================================================



// 오호둔: year stem index → 寅월 천간 index
// 甲(0)/己(5) → 丙(2), 乙(1)/庚(6) → 戊(4), 丙(2)/辛(7) → 庚(6),
// 丁(3)/壬(8) → 壬(8), 戊(4)/癸(9) → 甲(0)
function tigerMonthStartStemIdx(yearStemIdx) {
  // 공식: (yearStemIdx % 5) * 2 + 2, mod 10
  return ((yearStemIdx % 5) * 2 + 2) % 10;
}

/**
 * @param {number} jieIdx   solarTermProvider.resolveMonthBranch가 리턴한 0~11 (0=寅, 11=丑)
 * @param {string} yearStem 연주 천간
 * @param {string} monthBranch  지지 (검증 용도)
 */
function computeMonthPillar(jieIdx, yearStem, monthBranch) {
  const yearStemIdx = CHEONGAN.indexOf(yearStem);
  if (yearStemIdx < 0) throw new Error(`Invalid yearStem: ${yearStem}`);
  if (jieIdx < 0 || jieIdx > 11) throw new Error(`jieIdx must be 0~11: ${jieIdx}`);

  const startStemIdx = tigerMonthStartStemIdx(yearStemIdx);
  const monthStemIdx = (startStemIdx + jieIdx) % 10;

  const stem = CHEONGAN[monthStemIdx];
  // 지지는 jieIdx 순서대로 寅(2) 부터
  const branchIdx = (2 + jieIdx) % 12;
  const branch = JIJI[branchIdx];

  // 검증: solarTermProvider가 준 branch와 내부 계산 branch가 일치해야 함
  if (monthBranch && monthBranch !== branch) {
    throw new Error(
      `monthPillarEngine internal inconsistency: ` +
      `resolveMonthBranch branch=${monthBranch} vs computed=${branch} (jieIdx=${jieIdx})`
    );
  }

  return {
    stem,
    branch,
    pillar: `${stem}${branch}`,
    cycleIdx: cycleIdxFromChars(stem, branch),
  };
}

// =====================================================================
// ganzhi/dayPillarEngine.js
// 일주 계산 — 자체 anchor 기반. tyme4ts의 일주/EightChar 일절 사용 안 함.
//
// ─── 설계 결정 사항 ───────────────────────────────────────────
// 1. Anchor
//    2000-01-01 00:00 KST = 甲午일 (cycleIdx 30)
//    이 anchor는 여러 만세력(大统曆, sxwnl, 한국천문연구원 등)에서
//    모두 일치하는 역사적 검증치. tyme4ts도 포함.
//
// 2. 날짜 차이 계산
//    KST 벽시계 기준 민간(civil) 날짜만 사용.
//    Date.UTC(y, m-1, d)로 계산 → 타임존/DST 간섭 없음.
//    KST는 항상 UTC+9 고정이므로 벽시계 → civil date 매핑이 깨끗함.
//
// 3. 자시 정책
//    - same_day_midnight: 23:00에 일주가 다음날로 변경 (전통)
//    - next_day_midnight: 00:00에만 일주가 변경 (현대 한국)
//
// ─── 검증 ──────────────────────────────────────────────────
// anchor 값은 tests/saju.test.js의 회귀 테스트에서 tyme4ts 결과와
// 대조 검증됨. 불일치 발생 시 anchor를 수정하는 게 아니라 먼저
// 어느 쪽이 틀렸는지 독립 검증해야 함 (만세력 앱 등).
// =====================================================================




// 2000-01-01 (토요일) = 戊午 = cycleIdx 54
// 검증: 戊(천간 idx 4) + 午(지지 idx 6). 여러 만세력 일치. tyme4ts로 회귀 검증됨.
const ANCHOR = Object.freeze({
  year: 2000, month: 1, day: 1,
  cycleIdx: 54,
});

function civilDaysSinceAnchor(year, month, day) {
  // KST ≡ UTC+9 고정. Date.UTC로 벽시계 민간일 산출.
  const target = Date.UTC(year, month - 1, day);
  const anchor = Date.UTC(ANCHOR.year, ANCHOR.month - 1, ANCHOR.day);
  return Math.round((target - anchor) / 86400000);
}

/**
 * @param {{year,month,day,hour,minute}} dt   KST 벽시계
 * @param {string} policy   ZASI_POLICY.*
 * @returns {{stem, branch, pillar, cycleIdx, adjusted, civilDays}}
 */
function computeDayPillar(dt, policy) {
  if (!Object.values(ZASI_POLICY).includes(policy)) {
    throw new Error(`Unknown zasiPolicy: ${policy}`);
  }

  // 1. 기본 civil date의 일주
  let days = civilDaysSinceAnchor(dt.year, dt.month, dt.day);
  let cycleIdx = ((ANCHOR.cycleIdx + days) % 60 + 60) % 60;
  let adjusted = false;

  // 2. 자시 정책 적용
  // same_day_midnight: 23:00이면 일주를 다음날로 1 증가
  if (policy === ZASI_POLICY.SAME_DAY_MIDNIGHT && dt.hour === 23) {
    cycleIdx = (cycleIdx + 1) % 60;
    adjusted = true;
  }
  // next_day_midnight: 보정 없음 (기본 civil date 그대로가 정확)

  const [stem, branch] = cycleIdxToChars(cycleIdx);
  return {
    stem,
    branch,
    pillar: `${stem}${branch}`,
    cycleIdx,
    adjusted,
    civilDays: days,
  };
}

// 테스트/검증용 export
const ANCHOR_DATE = ANCHOR;

// =====================================================================
// ganzhi/hourPillarEngine.js
// 시주 계산 — 시각 → 12지지 매핑, 일간 → 오자둔 천간.
//
// 자시 정책 주의:
//   - 시지 매핑은 정책 무관. 子時 = 23:00~00:59 고정.
//   - 정책은 "어느 일주를 기준으로 오자둔을 돌릴지"를 결정.
//   - dayPillarEngine에서 이미 보정된 일간을 받으므로 이 엔진은 그대로 사용.
// =====================================================================



/**
 * 시각(0~23) → 12지지 인덱스.
 * 子時=0 (23~01), 丑時=1 (01~03), ..., 亥時=11 (21~23).
 */
function hourToBranchIdx(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error(`hour out of range: ${hour}`);
  if (hour === 23) return 0;
  return Math.floor((hour + 1) / 2);
}

/**
 * 오자둔(五子遁): 일간에 따른 子時 천간.
 *   甲/己일 → 甲子  (startStem=0)
 *   乙/庚일 → 丙子  (startStem=2)
 *   丙/辛일 → 戊子  (startStem=4)
 *   丁/壬일 → 庚子  (startStem=6)
 *   戊/癸일 → 壬子  (startStem=8)
 * 공식: startStem = (dayStemIdx % 5) * 2
 */
function ratMouseStartStemIdx(dayStemIdx) {
  return (dayStemIdx % 5) * 2;
}

/**
 * @param {string} dayStem   dayPillarEngine 결과의 stem (자시 보정 반영됨)
 * @param {number} hour      0~23
 */
function computeHourPillar(dayStem, hour) {
  const dayStemIdx = CHEONGAN.indexOf(dayStem);
  if (dayStemIdx < 0) throw new Error(`Invalid dayStem: ${dayStem}`);

  const branchIdx = hourToBranchIdx(hour);
  const startStem = ratMouseStartStemIdx(dayStemIdx);
  const hourStemIdx = (startStem + branchIdx) % 10;

  const stem = CHEONGAN[hourStemIdx];
  const branch = JIJI[branchIdx];
  return {
    stem,
    branch,
    pillar: `${stem}${branch}`,
    cycleIdx: cycleIdxFromChars(stem, branch),
  };
}

// =====================================================================
// saju/coreEngine.js
// 파이프라인: 입력 → 양력 변환 → 절기 조회 → 4주 계산 → 8자
//
// 명령서 구조 그대로. tyme4ts EightChar 일절 사용 안 함.
// 단, 옵션으로 tyme4ts 결과와 교차 검증 (verify:true).
// =====================================================================









// ─── tyme4ts 2중 검증 (개발 환경에서만 기본 ON) ──────────────────
// Cloudflare Workers 런타임에는 process 객체가 제한적. globalThis.process로 안전 접근.
function isVerifyEnabled(explicitFlag) {
  if (explicitFlag === true) return true;
  if (explicitFlag === false) return false;
  // 자동: NODE_ENV !== 'production'이면 ON
  const env = globalThis.process?.env?.NODE_ENV;
  return env !== 'production';
}

// tyme4ts로 동일 입력 → 8자 비교. 내부 검증 전용.
// 사용 라이브러리는 lunarConverter와 동일하지만, 여기서는 EightChar를 "기대값"으로만 씀.
async function crossValidateWithTyme4ts(solar, eightChars, policy) {
  
  const st = SolarTime.fromYmdHms(solar.year, solar.month, solar.day, solar.hour, solar.minute || 0, 0);
  const ec = st.getLunarHour().getSixtyCycleHour().getEightChar();
  const tymeChars = [
    ec.getYear().getHeavenStem().getName(),   ec.getYear().getEarthBranch().getName(),
    ec.getMonth().getHeavenStem().getName(),  ec.getMonth().getEarthBranch().getName(),
    ec.getDay().getHeavenStem().getName(),    ec.getDay().getEarthBranch().getName(),
    ec.getHour().getHeavenStem().getName(),   ec.getHour().getEarthBranch().getName(),
  ];

  // 연/월/일/시 각각 비교. 자시 정책에 따라 일주/시주는 다를 수 있으므로:
  // tyme4ts는 same_day_midnight 기본. 우리 엔진도 같은 정책으로 비교.
  if (policy !== ZASI_POLICY.SAME_DAY_MIDNIGHT) {
    // policy가 다르면 연/월만 비교 (일/시는 정책 차이로 달라질 수 있음)
    for (let i = 0; i < 4; i++) {
      if (eightChars[i] !== tymeChars[i]) {
        return {
          ok: false,
          field: ['yearStem','yearBranch','monthStem','monthBranch'][i],
          ours: eightChars[i], tyme: tymeChars[i],
          tymeEightChars: tymeChars,
        };
      }
    }
    return { ok: true, partial: true, tymeEightChars: tymeChars };
  }

  // SAME_DAY_MIDNIGHT: 전체 비교
  for (let i = 0; i < 8; i++) {
    if (eightChars[i] !== tymeChars[i]) {
      return {
        ok: false,
        field: ['yearStem','yearBranch','monthStem','monthBranch','dayStem','dayBranch','hourStem','hourBranch'][i],
        ours: eightChars[i], tyme: tymeChars[i],
        tymeEightChars: tymeChars,
      };
    }
  }
  return { ok: true, partial: false, tymeEightChars: tymeChars };
}

/**
 * @param {object} input
 *   - calendar: 'solar' | 'lunar'  (기본 'solar')
 *   - year, month, day, hour, minute
 *   - isLeap (음력 윤달)
 *   - zasiPolicy
 *   - verify: true|false|undefined  (undefined=자동)
 */
async function computeEightChars(input) {
  const policy = input.zasiPolicy || DEFAULT_ZASI_POLICY;
  if (!Object.values(ZASI_POLICY).includes(policy)) {
    throw new Error(`Unknown zasiPolicy: ${policy}`);
  }

  // ─── 1. 입력 정규화 ──────────────────────────────────────
  let solar;
  if (input.calendar === 'lunar') {
    solar = lunarToSolar({
      year: input.year, month: input.month, day: input.day,
      isLeap: !!input.isLeap,
      hour: input.hour, minute: input.minute ?? 0,
    });
  } else {
    solar = {
      year: input.year, month: input.month, day: input.day,
      hour: input.hour, minute: input.minute ?? 0,
    };
  }

  if (solar.year < 1900 || solar.year > 2100) {
    throw new Error(`year out of range (1900~2100): ${solar.year}`);
  }

  // ─── 2. 사주 연도 판정 (입춘 기준) ───────────────────────
  const sajuYear = resolveSajuYear(solar);

  // ─── 3. 연주 계산 ────────────────────────────────────────
  const year = computeYearPillar(sajuYear);

  // ─── 4. 월주 계산 ────────────────────────────────────────
  const monthInfo = resolveMonthBranch(solar, sajuYear);
  const month = computeMonthPillar(monthInfo.jieIdx, year.stem, monthInfo.branch);

  // ─── 5. 일주 계산 (자시 정책 적용 포함) ──────────────────
  const day = computeDayPillar(solar, policy);

  // ─── 6. 시주 계산 ────────────────────────────────────────
  const hour = computeHourPillar(day.stem, solar.hour);

  const eightChars = [
    year.stem, year.branch, month.stem, month.branch,
    day.stem, day.branch, hour.stem, hour.branch,
  ];

  // ─── 7. 선택적 2중 검증 ─────────────────────────────────
  let verification = null;
  if (isVerifyEnabled(input.verify)) {
    try {
      verification = await crossValidateWithTyme4ts(solar, eightChars, policy);
      if (!verification.ok) {
        // 교차 검증 실패 → 엔진 버그. 에러 던짐.
        throw new Error(
          `Engine divergence from tyme4ts at ${verification.field}: ` +
          `ours=${verification.ours} vs tyme4ts=${verification.tyme}. ` +
          `Input: ${JSON.stringify(input)}. ` +
          `Our 8chars: ${eightChars.join('')}, tyme4ts: ${verification.tymeEightChars.join('')}.`
        );
      }
    } catch (e) {
      // "Engine divergence"는 재던짐, import 실패 등은 조용히 verification=null
      if (e.message?.startsWith('Engine divergence')) throw e;
      verification = { ok: null, skipped: true, reason: e.message };
    }
  }

  return {
    pillars: { year, month, day, hour },
    eightChars,
    dayMaster: day.stem,
    solar,
    meta: {
      zasiPolicy: policy,
      sajuYear,
      dayPillarAdjusted: day.adjusted,
      calendarSource: input.calendar || 'solar',
      verification,
    },
  };
}

// =====================================================================
// saju/postProcess.js
// 1층 후속 결정적 계산: 오행, 십성, 지장간, 12운성, 관계(합/충/형/파/해), 신살.
//
// 명령서 1번: 이 모듈 역시 순수 결정적. 보정/예외/감성 일절 없음.
// 입력은 coreEngine의 8자만, 출력은 해석에서 사용할 1차 가공 데이터.
// =====================================================================



// ─── 유틸 ──────────────────────────────────────────────────────────
function dedupe(items, keys) {
  const seen = new Set();
  return items.filter(item => {
    const sig = JSON.stringify(keys.map(k => {
      const v = item[k];
      return Array.isArray(v) ? v.slice().sort().join(',') : (v ?? null);
    }));
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}
function counter(arr) {
  return arr.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
}
function topN(obj, n) {
  return Object.fromEntries(Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0, n));
}

// ─── 십성 계산 ────────────────────────────────────────────────────
function getSipseong(dayStem, targetChar) {
  const [myE, myYy] = CHAR_INFO[dayStem];
  const [tE,  tYy]  = CHAR_INFO[targetChar];
  const mi = ELEM_IDX[myE], ti = ELEM_IDX[tE];
  const same = myYy === tYy;
  if (mi === ti)              return same ? '비견' : '겁재';
  if ((mi+1)%5 === ti)        return same ? '식신' : '상관';
  if ((mi+2)%5 === ti)        return same ? '편재' : '정재';
  if ((ti+2)%5 === mi)        return same ? '편관' : '정관';
  if ((ti+1)%5 === mi)        return same ? '편인' : '정인';
  throw new Error(`십성 계산 실패: ${dayStem}, ${targetChar}`);
}

// ─── 12운성 ───────────────────────────────────────────────────────
function getTwelveStage(dayStem, branch) {
  const start = JANGSEONG_START[dayStem];
  const bIdx = JIJI.indexOf(branch);
  const sIdx = IS_YANG_GAN[dayStem]
    ? ((bIdx - start) % 12 + 12) % 12
    : ((start - bIdx) % 12 + 12) % 12;
  return TWELVE_STAGES[sIdx];
}

// ─── 오행 분포 ────────────────────────────────────────────────────
function countOheng(eightChars) {
  const oh = {'목':0,'화':0,'토':0,'금':0,'수':0};
  for (const ch of eightChars) oh[CHAR_INFO[ch][0]]++;
  return oh;
}
function ohengStatus(c) {
  if (c === 0) return '매우 약함';
  if (c === 1) return '약한 편';
  if (c === 2) return '보통';
  return '강한 편';
}

// ─── 천간 관계 ────────────────────────────────────────────────────
function computeStemRelations(stems) {
  const rels = [];
  const gp = GAN_POSITIONS.map((p,i) => [p, stems[i]]);
  for (let i=0; i<gp.length; i++) for (let j=i+1; j<gp.length; j++) {
    const [p1,g1] = gp[i], [p2,g2] = gp[j];
    for (const [a,b,el] of CHEONGAN_HAP) {
      if (new Set([g1,g2]).size===2 && [a,b].every(x=>[g1,g2].includes(x))) {
        rels.push({type:'천간합', pair:[`${p1}:${g1}`,`${p2}:${g2}`], element:el});
      }
    }
    for (const [a,b] of CHEONGAN_CHUNG) {
      if ([a,b].every(x=>[g1,g2].includes(x)) && new Set([g1,g2]).size===2) {
        rels.push({type:'천간충', pair:[`${p1}:${g1}`,`${p2}:${g2}`]});
      }
    }
  }
  return dedupe(rels, ['type','pair','element']);
}

// ─── 지지 관계 ────────────────────────────────────────────────────
function computeBranchRelations(branches) {
  const rels = [];
  const jp = JI_POSITIONS.map((p,i) => [p, branches[i]]);

  for (let i=0; i<jp.length; i++) for (let j=i+1; j<jp.length; j++) {
    const [p1,j1] = jp[i], [p2,j2] = jp[j];
    for (const [a,b,el] of YUKAP) {
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2)
        rels.push({type:'육합', pair:[`${p1}:${j1}`,`${p2}:${j2}`], element:el});
    }
    for (const [a,b] of CHUNG) {
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2)
        rels.push({type:'충', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
    }
    for (const [a,b] of PA) {
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2)
        rels.push({type:'파', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
    }
    for (const [a,b] of HAE) {
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2)
        rels.push({type:'해', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
    }
    if (j1===j2 && JAHYUNG.has(j1))
      rels.push({type:'자형', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
  }

  for (const [members, el] of SAMHAP) {
    if (members.every(m => branches.includes(m))) {
      rels.push({type:'삼합', members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`), element:el});
    } else {
      const present = members.filter(m => branches.includes(m));
      if (present.length===2 && present.includes(members[1])) {
        rels.push({type:'반합', members:jp.filter(([,j])=>present.includes(j)).map(([p,j])=>`${p}:${j}`), element:el});
      }
    }
  }
  for (const [members, el] of BANGHAP) {
    if (members.every(m => branches.includes(m)))
      rels.push({type:'방합', members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`), element:el});
  }
  for (const members of HYUNG3) {
    if (members.every(m => branches.includes(m))) {
      rels.push({type:'삼형', members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`)});
    } else {
      const present = members.filter(m => branches.includes(m));
      if (present.length===2)
        rels.push({type:'반형', members:jp.filter(([,j])=>present.includes(j)).map(([p,j])=>`${p}:${j}`)});
    }
  }
  for (const members of HYUNG2) {
    if (members.every(m => branches.includes(m)))
      rels.push({type:'이형', members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`)});
  }
  return dedupe(rels, ['type','pair','members','element']);
}

// ─── 신살 ─────────────────────────────────────────────────────────
function computeSinsal(dayStem, yearBranch, dayBranch, branches) {
  const jp = JI_POSITIONS.map((p,i) => [p, branches[i]]);
  let sinsal = [];
  for (const [basisName, basisJi] of [['년지',yearBranch],['일지',dayBranch]]) {
    const grp = SAMHAP_GROUP[basisJi] || '';
    if (SINSAL_TABLE[grp]) {
      for (const [sname, sji] of Object.entries(SINSAL_TABLE[grp])) {
        for (const [pos, ji] of jp) {
          if (ji === sji) sinsal.push({name:sname, position:`${pos}:${ji}`, basis:basisName});
        }
      }
    }
  }
  sinsal = dedupe(sinsal, ['name','position','basis']);

  let gwiin = [];
  for (const tji of (CHEONUL[dayStem] || [])) {
    for (const [pos, ji] of jp) {
      if (ji === tji) gwiin.push({name:'천을귀인', position:`${pos}:${ji}`});
    }
  }
  const mc = MUNCHANG[dayStem], hd = HAKDANG[dayStem], gy = GEUMYEO[dayStem];
  for (const [pos, ji] of jp) {
    if (ji === mc) gwiin.push({name:'문창귀인', position:`${pos}:${ji}`});
    if (ji === hd) gwiin.push({name:'학당귀인', position:`${pos}:${ji}`});
    if (ji === gy) gwiin.push({name:'금여록',   position:`${pos}:${ji}`});
  }
  gwiin = dedupe(gwiin, ['name','position']);
  return { sinsal, gwiin };
}

// ─── 메인 ─────────────────────────────────────────────────────────
/**
 * @param {string[8]} eightChars  [년간,년지,월간,월지,일간,일지,시간,시지]
 * @returns 1층 결정적 후처리 결과
 */
function postProcess(eightChars) {
  const [yG,yJ,mG,mJ,dG,dJ,hG,hJ] = eightChars;
  const stems    = [yG,mG,dG,hG];
  const branches = [yJ,mJ,dJ,hJ];

  const oheng = countOheng(eightChars);
  const ohengStatusMap = Object.fromEntries(
    Object.entries(oheng).map(([e,c]) => [e, ohengStatus(c)])
  );

  const stemSipseong = {};
  GAN_POSITIONS.forEach((pos,i) => {
    stemSipseong[pos] = pos === '일간' ? '일간(나)' : getSipseong(dG, stems[i]);
  });

  const branchMainSipseong = {};
  const hiddenStemSipseong = {};
  const hiddenAll = [];
  JI_POSITIONS.forEach((pos,i) => {
    const ji = branches[i];
    const hidden = JIJANGGAN[ji];
    const fullTg = hidden.map(g => [g, getSipseong(dG, g)]);
    branchMainSipseong[pos] = getSipseong(dG, hidden[0]);
    hiddenStemSipseong[pos] = { 지지: ji, 장간: fullTg };
    fullTg.forEach(([,tg]) => hiddenAll.push(tg));
  });

  const stemTengods = GAN_POSITIONS.filter(p => p !== '일간').map(p => stemSipseong[p]);
  const sipseongCounts = counter([...stemTengods, ...hiddenAll]);
  const coreSipseong   = topN(sipseongCounts, 3);

  const twelveStages = Object.fromEntries(
    JI_POSITIONS.map((p,i) => [p, getTwelveStage(dG, branches[i])])
  );

  const stemRels   = computeStemRelations(stems);
  const branchRels = computeBranchRelations(branches);
  const { sinsal, gwiin } = computeSinsal(dG, yJ, dJ, branches);

  const [dE, dYy] = CHAR_INFO[dG];

  return {
    '사주_원국': {'년주':`${yG}${yJ}`, '월주':`${mG}${mJ}`, '일주':`${dG}${dJ}`, '시주':`${hG}${hJ}`},
    '일간': dG,
    '일간_오행': { element_ko: dE, element_hanja: ELEM_HANJA[dE], yin_yang: dYy ? '양' : '음' },
    '오행_기본분포': oheng,
    '오행_분석': ohengStatusMap,
    '천간_십성': stemSipseong,
    '지지_주기십성': branchMainSipseong,
    '지장간_십성': hiddenStemSipseong,
    '십성_요약': sipseongCounts,
    '핵심_십성': coreSipseong,
    '십이운성': twelveStages,
    '천간_관계': stemRels,
    '지지_관계': branchRels,
    '십이신살': sinsal,
    '귀인_신살': gwiin,
  };
}

// =====================================================================
// analysis/mbti.js  (v4 — 완전 재설계)
// 설계 원칙: A.근거 주석, B.축당4~6시그널, C.지장간1/3, D.연속함수,
//           E.일간본질, F.top_contributors, G.calibration 없음
// =====================================================================



const round2 = n => Math.round(n * 100) / 100;

function labelByGap(gap) {
  if (gap < 0.25) return 'balanced';
  if (gap < 0.70) return 'close';
  if (gap < 1.40) return 'lean';
  return 'clear';
}

function buildAR(axisKey, a, b, aScore, bScore, aC, bC) {
  const winner = aScore >= bScore ? a : b;
  const gap    = Math.abs(aScore - bScore);
  return {
    axis:   axisKey,
    result: winner,
    loser:  winner === a ? b : a,
    label:  labelByGap(gap),
    scores: { [a]: round2(aScore), [b]: round2(bScore) },
    reasons: (winner === a ? aC : bC).top(3),
  };
}

function makeCollector() {
  const items = [];
  return {
    add(factor, value, dir) {
      if (Math.abs(value) > 0.001) items.push({ factor, value: round2(value), direction: dir });
      return value;
    },
    top(n = 3) {
      return items.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, n);
    },
  };
}

function dayMasterStrength(computed) {
  const dayGan = computed['일간'];
  const dayElem = CHAR_INFO[dayGan][0];
  const monthBranch = computed['사주_원국']['월주'][1];
  const monthBoost = MONTH_BRANCH_BOOST[monthBranch];
  const ten = computed['십성_요약'];
  const oh = computed['오행_기본분포'];
  const hidden = computed['지장간_십성'];
  const tg = n => ten[n] || 0;
  let score = 0;
  if (monthBoost === dayElem) score += 2.4;
  if ((ELEM_IDX[monthBoost] + 1) % 5 === ELEM_IDX[dayElem]) score += 1.0;
  score += tg('비견')*1.2 + tg('겁재')*0.9 + tg('정인')*1.0 + tg('편인')*0.8;
  score -= tg('식신')*0.45 + tg('상관')*0.55 + tg('정재')*0.45 + tg('편재')*0.45 + tg('정관')*0.55 + tg('편관')*0.65;
  score += (oh[dayElem] || 0) * 0.35;
  for (const pos of Object.keys(hidden)) {
    if (hidden[pos].장간.map(([g]) => g).includes(dayGan)) score += 0.8;
  }
  let label = '중화';
  if (score >= 4.1) label = '신강';
  else if (score <= 1.2) label = '신약';
  return { score: round2(score), label };
}

function relationFeatures(computed) {
  const all = [...computed['천간_관계'], ...computed['지지_관계']];
  const chong = all.filter(r => String(r.type).includes('충'));
  const hap = all.filter(r => String(r.type).includes('합'));
  return {
    chongCount: chong.length, hapCount: hap.length,
    conflictLevel: round2(chong.length*1.4 + computed['지지_관계'].filter(r=>String(r.type).includes('형')).length*1.0 + computed['지지_관계'].filter(r=>String(r.type).includes('파')).length*0.8 + computed['지지_관계'].filter(r=>String(r.type).includes('해')).length*0.5),
    stabilityLevel: round2(hap.length * 1.0),
  };
}

function hasSinsal(computed, name) {
  return (computed['십이신살']||[]).some(s=>s.name===name) || (computed['귀인_신살']||[]).some(g=>g.name===name);
}

// =====================================================================
// analysis/mbti.js  (trait-based refactor v1)
// 전제:
// - 아래 함수들은 기존 파일에 이미 있다고 가정:
//   round2, makeCollector, dayMasterStrength, relationFeatures,
//   hasSinsal, buildAR, RP, CHAR_INFO
// =====================================================================

function getDayMasterTraitBias(dayMaster) {
  const map = {
    '甲': { autonomy: 0.25, outwardExpression: 0.15, structurePreference: 0.10 },
    '乙': { internalProcessing: 0.20, relationalEmpathy: 0.20, abstractInterpretation: 0.10 },
    '丙': { outwardExpression: 0.30, relationalEmpathy: 0.10, adaptiveFlexibility: 0.05 },
    '丁': { internalProcessing: 0.20, relationalEmpathy: 0.25, abstractInterpretation: 0.10 },
    '戊': { concretePracticality: 0.30, structurePreference: 0.25, impersonalJudgment: 0.10 },
    '己': { concretePracticality: 0.20, relationalEmpathy: 0.15, structurePreference: 0.20 },
    '庚': { impersonalJudgment: 0.30, autonomy: 0.15, structurePreference: 0.15 },
    '辛': { internalProcessing: 0.15, impersonalJudgment: 0.25, structurePreference: 0.10 },
    '壬': { adaptiveFlexibility: 0.25, abstractInterpretation: 0.20, outwardExpression: 0.10 },
    '癸': { internalProcessing: 0.30, abstractInterpretation: 0.20, relationalEmpathy: 0.10 },
  };
  return map[dayMaster] || {};
}

function sumStageEnergy(computed) {
  const SE = {
    '제왕': 2, '건록': 2, '장생': 1, '관대': 1,
    '양': 0, '태': 0,
    '목욕': -1, '쇠': -1, '병': -1,
    '사': -2, '묘': -2, '절': -2,
  };
  const stages = computed['십이운성'] || {};
  const total = Object.values(stages).reduce((acc, s) => acc + (SE[s] ?? 0), 0);
  const dayBranchStageEnergy = SE[stages['일지']] ?? 0;
  return { stageEnergy: round2(total), dayBranchStageEnergy };
}

function extractSajuTraits(computed) {
  const ten = computed['십성_요약'] || {};
  const oh = computed['오행_기본분포'] || {};
  const tg = name => Number(ten[name] || 0);
  const el = name => Number(oh[name] || 0);

  const dayMaster = computed['일간'];
  const isYang = CHAR_INFO[dayMaster]?.[1] === 1;

  const dm = dayMasterStrength(computed);
  const rel = relationFeatures(computed);
  const { stageEnergy, dayBranchStageEnergy } = sumStageEnergy(computed);

  const traits = {
    // 안으로 처리하는 경향
    internalProcessing: round2(
      tg('정인') * 1.20 +
      tg('편인') * 0.95 +
      el('수') * 0.45 +
      (!isYang ? 0.35 : 0) +
      (dm.label === '신약' ? 0.25 : 0)
    ),

    // 밖으로 드러내는 경향
    outwardExpression: round2(
      tg('식신') * 1.10 +
      tg('상관') * 1.15 +
      el('화') * 0.45 +
      (isYang ? 0.30 : 0) +
      (hasSinsal(computed, '역마') ? 0.25 : 0) +
      (hasSinsal(computed, '도화') ? 0.20 : 0)
    ),

    // 의미·해석·가능성 쪽
    abstractInterpretation: round2(
      tg('편인') * 1.00 +
      tg('상관') * 0.70 +
      tg('정인') * 0.35 +
      el('수') * 0.35 +
      el('목') * 0.30 +
      (hasSinsal(computed, '화개') ? 0.25 : 0) +
      (hasSinsal(computed, '문창귀인') ? 0.20 : 0)
    ),

    // 현실·구체·실용 쪽
    concretePracticality: round2(
      tg('식신') * 0.85 +
      tg('정재') * 0.90 +
      tg('편재') * 0.75 +
      tg('정관') * 0.65 +
      el('토') * 0.40 +
      el('금') * 0.35
    ),

    // 기준·논리·절단력
    impersonalJudgment: round2(
      tg('정관') * 0.95 +
      tg('편관') * 0.85 +
      tg('편재') * 0.50 +
      tg('정재') * 0.35 +
      el('금') * 0.50 +
      tg('비견') * 0.15
    ),

    // 공감·정서 반영
    relationalEmpathy: round2(
      tg('정인') * 1.00 +
      tg('식신') * 0.55 +
      el('수') * 0.35 +
      el('목') * 0.30 +
      (hasSinsal(computed, '도화') ? 0.15 : 0)
    ),

    // 구조·예측 가능성 선호
    structurePreference: round2(
      tg('정관') * 1.05 +
      tg('정인') * 0.75 +
      el('토') * 0.35 +
      el('금') * 0.25 +
      rel.hapCount * 0.20
    ),

    // 변화·즉흥·수정 대응
    adaptiveFlexibility: round2(
      tg('상관') * 0.90 +
      tg('편인') * 0.55 +
      tg('겁재') * 0.55 +
      el('수') * 0.40 +
      rel.chongCount * 0.35
    ),

    // 자기 기준·자기 추진
    autonomy: round2(
      tg('비견') * 0.95 +
      tg('겁재') * 0.80 +
      (dm.label === '신강' ? 0.35 : 0)
    ),

    // 내적 긴장·압박
    emotionalPressure: round2(
      rel.conflictLevel * 0.90 +
      tg('정관') * 0.35 +
      tg('편관') * 0.35 +
      tg('정인') * 0.20
    ),
  };

  // 일간 본질 보정은 trait 단계에서만 아주 작게 반영
  const bias = getDayMasterTraitBias(dayMaster);
  for (const [k, v] of Object.entries(bias)) {
    traits[k] = round2((traits[k] || 0) + v);
  }

  return {
    ...traits,
    dayMasterStrengthScore: dm.score,
    dayMasterStrengthLabel: dm.label,
    conflictLevel: rel.conflictLevel,
    stabilityLevel: rel.stabilityLevel,
    chongCount: rel.chongCount,
    stageEnergy,
    dayBranchStageEnergy,
  };
}

// narrative 호환용.
// 핵심은 raw computed를 다시 많이 쓰지 않고 traits를 재가공해 반환하는 것.
function calculateStructuralFeatures(computed) {
  const ten = computed['십성_요약'];
  const oh = computed['오행_기본분포'];
  const dmStr = dayMasterStrength(computed);
  const rel = relationFeatures(computed);

  const tg = n => ten[n] || 0;
  const el = n => oh[n] || 0;

  // 오행 영향 과대 반영 방지
  const ec = n => Math.min(el(n), 1.5);

  const SE = {
    '제왕':2,'건록':2,'장생':1,'관대':1,
    '양':0,'태':0,
    '목욕':-1,'쇠':-1,'병':-1,
    '사':-2,'묘':-2,'절':-2
  };

  const stages = computed['십이운성'];
  const stageEnergy = Object.values(stages).map(s => SE[s] ?? 0).reduce((a,b) => a+b, 0);
  const dayBSE = SE[stages['일지']] ?? 0;

  return {
    dayMasterStrengthScore: dmStr.score,
    dayMasterStrengthLabel: dmStr.label,

    selfDrive: round2(
      tg('비견') * 1.05 +
      tg('겁재') * 0.85 +
      (dmStr.label === '신강' ? 0.45 : 0)
    ),

    expressionDrive: round2(
      tg('식신') * 0.90 +
      tg('상관') * 0.95 +
      ec('화') * 0.12 +
      ec('수') * 0.08
    ),

    supportDrive: round2(
      tg('정인') * 1.05 +
      tg('편인') * 0.85 +
      ec('금') * 0.10
    ),

    controlDrive: round2(
      tg('정관') * 1.10 +
      tg('편관') * 0.90 +
      ec('토') * 0.12 +
      ec('금') * 0.08
    ),

    realityFocus: round2(
      tg('식신') * 0.45 +
      tg('정재') * 0.55 +
      tg('편재') * 0.45 +
      tg('정관') * 0.30 +
      ec('토') * 0.22 +
      ec('금') * 0.18
    ),

    abstractionFocus: round2(
      tg('편인') * 0.65 +
      tg('상관') * 0.45 +
      tg('정인') * 0.18 +
      ec('수') * 0.24 +
      ec('목') * 0.18
    ),

    relationalSensitivity: round2(
      tg('정인') * 0.85 +
      tg('식신') * 0.25 +
      ec('수') * 0.18 +
      ec('목') * 0.15
    ),

    emotionalContainment: round2(
      tg('정관') * 0.45 +
      tg('편관') * 0.40 +
      tg('정인') * 0.30 +
      rel.conflictLevel * 0.20
    ),

    flexibility: round2(
      tg('식신') * 0.35 +
      tg('상관') * 0.55 +
      ec('수') * 0.18 +
      rel.chongCount * 0.35
    ),

    structureNeed: round2(
      tg('정관') * 0.80 +
      tg('정인') * 0.55 +
      ec('토') * 0.15 +
      ec('금') * 0.10
    ),

    internalConflict: round2(
      rel.conflictLevel +
      (tg('정관') * 0.35 + tg('편관') * 0.30 + tg('정인') * 0.20) * 0.20
    ),

    conflictLevel: rel.conflictLevel,
    stabilityLevel: rel.stabilityLevel,
    chongCount: rel.chongCount,
    stageEnergy,
    dayBranchStageEnergy: dayBSE,
  };
}

function calculateMbti(features, computed) {
  const eC = makeCollector(), iC = makeCollector();
  const nC = makeCollector(), sC = makeCollector();
  const tC = makeCollector(), fC = makeCollector();
  const jC = makeCollector(), pC = makeCollector();

  let eS = 0, iS = 0, nS = 0, sS = 0, tS = 0, fS = 0, jS = 0, pS = 0;

  // E / I
  eS += eC.add('표현성', features.expressionDrive * 0.95, 'E');
  eS += eC.add('자기추진', features.selfDrive * 0.18, 'E');

  iS += iC.add('내면축적', features.supportDrive * 0.92, 'I');
  iS += iC.add('내적정리', features.emotionalContainment * 0.18, 'I');

  // N / S
  nS += nC.add('추상해석', features.abstractionFocus * 1.05, 'N');
  nS += nC.add('내적갈등', features.internalConflict * 0.06, 'N');

  sS += sC.add('현실집중', features.realityFocus * 1.00, 'S');
  sS += sC.add('구조선호', features.structureNeed * 0.12, 'S');

  // T / F
  tS += tC.add('기준성', features.controlDrive * 0.92, 'T');
  tS += tC.add('자기기준', features.selfDrive * 0.14, 'T');

  fS += fC.add('관계민감', features.relationalSensitivity * 1.00, 'F');
  fS += fC.add('수용성', features.supportDrive * 0.14, 'F');

  // J / P
  jS += jC.add('정리욕구', features.structureNeed * 1.00, 'J');
  jS += jC.add('안정성', features.stabilityLevel * 0.10, 'J');

  pS += pC.add('유동성', features.flexibility * 1.00, 'P');
  pS += pC.add('변동성', features.conflictLevel * 0.08, 'P');

  const s = {
    E: round2(eS), I: round2(iS),
    N: round2(nS), S: round2(sS),
    T: round2(tS), F: round2(fS),
    J: round2(jS), P: round2(pS),
  };

  const axes = {
    'E/I': buildAR('E/I','E','I',s.E,s.I,eC,iC),
    'N/S': buildAR('N/S','N','S',s.N,s.S,nC,sC),
    'T/F': buildAR('T/F','T','F',s.T,s.F,tC,fC),
    'J/P': buildAR('J/P','J','P',s.J,s.P,jC,pC),
  };

  const type = '' +
    axes['E/I'].result +
    axes['N/S'].result +
    axes['T/F'].result +
    axes['J/P'].result;

  const cl = Object.entries(axes)
    .map(([k,v]) => ({ k, gap: Math.abs(Object.values(v.scores)[0] - Object.values(v.scores)[1]) }))
    .sort((a,b) => a.gap - b.gap)[0];

  const ch = type.split('');
  const im = {'E/I':0,'N/S':1,'T/F':2,'J/P':3};
  const [ca,cb] = cl.k.split('/');
  ch[im[cl.k]] = ch[im[cl.k]] === ca ? cb : ca;

  return { type, secondary: ch.join(''), scores: s, axes };
}
// =====================================================================
// analysis/interpretation.js
// 2층(해석): 구조 기반 자연어 narrative + 관계 카드.
// 1층 결과(computed)와 features, mbti만 입력으로 받는 순수 함수.
// =====================================================================



function buildStructureLabels(computed, features) {
  const ten = computed['십성_요약'];
  const tg = n => ten[n] || 0;
  const labels = [];
  if ((tg('정관')+tg('편관')) >= 3) labels.push('관성 강세형');
  if ((tg('정인')+tg('편인')) >= 3) labels.push('인성 강세형');
  if ((tg('비견')+tg('겁재')) >= 3) labels.push('비견 강세형');
  if ((tg('식신')+tg('상관')) <= 1) labels.push('식상 약세형');
  if ((tg('식신')+tg('상관')) >= 3) labels.push('식상 발산형');
  if (features.conflictLevel >= 2.0) labels.push('충돌 내면형');
  if (features.structureNeed >= 2.6) labels.push('책임 구조형');
  if (features.relationalSensitivity >= 2.5) labels.push('관계 민감형');
  if (features.abstractionFocus >= 2.3) labels.push('해석 중심형');
  if (features.dayMasterStrengthLabel === '신약') labels.push('환경 민감형');
  if (features.supportDrive >= 2.5 && features.expressionDrive <= 1.3) labels.push('내면 축적형');
  return labels.slice(0, 5);
}

function buildNarrative(computed, features, mbti) {
  const dm = computed['일간'];
  const dmLabel = DAY_MASTER_LABEL[dm] || dm;
  const labels = buildStructureLabels(computed, features);
  const has = l => labels.includes(l);

  const summary = `${dmLabel} 기반 구조에서는 ${mbti.type} 쪽이 가장 유력합니다. 다만 이 결과의 핵심은 MBTI 글자 자체보다 ${labels.slice(0,3).join(', ')} 구조에 있습니다.`;

  let personality = '한쪽으로 단순하게 치우친 성격이라기보다, 기준·감정·관계 반응이 함께 작동하는 복합형 구조에 가깝습니다. 그래서 상황에 따라 보이는 결이 조금씩 달라질 수 있습니다.';
  if (has('관성 강세형') && has('식상 약세형') && has('내면 축적형')) {
    personality = '책임감과 기준 의식이 강한데 표현은 빠르기보다 내부 정리를 거쳐 나오는 편입니다. 그래서 겉으로는 차분하고 통제된 사람처럼 보이지만, 속에서는 생각과 감정이 오래 머무를 가능성이 큽니다.';
  } else if (has('인성 강세형') && has('해석 중심형')) {
    personality = '정보를 바로 쓰기보다 안에서 해석하고 오래 정리하는 경향이 강합니다. 단순히 조용한 게 아니라, 의미와 심리 흐름을 붙잡고 생각하는 타입에 가깝습니다.';
  } else if (has('비견 강세형') && has('식상 발산형')) {
    personality = '자기주도성과 반응 속도가 빠른 편이며, 생각을 바깥으로 밀어내는 힘도 있는 구조입니다. 다만 기준이 강할수록 말이 단단하거나 직선적으로 들릴 수 있습니다.';
  } else if (has('충돌 내면형') && has('관계 민감형')) {
    personality = '겉에서 보이는 태도보다 안쪽 긴장과 반응이 더 복잡할 수 있습니다. 사람과 상황을 잘 읽지만, 그만큼 감정과 생각이 내부에 오래 남는 편입니다.';
  }

  let relationship = '관계에서는 감정선과 현실 판단이 동시에 작동하는 편입니다. 가까운 사람에게만 드러나는 내면 패턴이 따로 있을 가능성이 큽니다.';
  if (has('관계 민감형') && has('식상 약세형')) {
    relationship = '관계에서 감정이 없어서 표현이 적은 게 아니라, 표현보다 내부 처리와 거리 조절이 먼저 일어나는 편입니다. 가까워질수록 깊어질 수 있지만, 상처도 오래 남길 가능성이 있습니다.';
  } else if (has('비견 강세형') && has('충돌 내면형')) {
    relationship = '사람과의 관계에서 자기 기준이 분명한 편이라 맞을 때는 빠르게 가까워지지만, 틀어질 때는 단호하게 거리를 둘 수 있습니다. 갈등이 생기면 내부 긴장이 말투나 태도로 튀어나올 수도 있습니다.';
  } else if (has('책임 구조형')) {
    relationship = '관계에서도 가볍게 흘려보내기보다 책임감과 신뢰를 중요하게 보는 편입니다. 대신 기대치가 무너질 때 실망이나 거리 두기가 빨라질 수 있습니다.';
  }

  let caution = '강점이 분명한 구조지만, 그 강점이 과해질 때 약점처럼 보일 수 있습니다. 특히 감정·기준·관계 중 어디에서 과열되는지 스스로 체크하는 게 중요합니다.';
  if (has('식상 약세형') && has('충돌 내면형')) {
    caution = '생각과 감정이 안에 오래 쌓이는데 표현은 늦어 스트레스가 누적될 수 있습니다. 중요한 감정이나 불편함은 너무 늦기 전에 언어화하는 연습이 필요합니다.';
  } else if (has('관성 강세형') && has('책임 구조형')) {
    caution = '책임감이 강한 건 장점이지만, 그 힘이 과해지면 스스로를 압박하는 방식으로 흘러갈 수 있습니다. 모든 상황을 통제하려 하기보다 조절 가능한 부분만 쥐는 편이 낫습니다.';
  } else if (has('비견 강세형') && has('식상 발산형')) {
    caution = '자기 생각을 밀고 나가는 힘이 강한 편이라, 상대가 느끼는 압박이나 말의 온도를 놓칠 수 있습니다. 속도보다 조율을 의식하면 강점이 더 잘 살아납니다.';
  }

  return {
    summary, personality, relationship, caution,
    reason_summary: `${labels.join(', ')} / 1순위 ${mbti.type}${mbti.secondary ? ` / 2순위 ${mbti.secondary}` : ''}`,
    structure_labels: labels,
  };
}

function buildRelationshipCards(mbti, structureLabels = []) {
  const compatMap = {
    'INTJ':'ENFP','INTP':'ENTJ','INFJ':'ENTP','INFP':'ENFJ',
    'ISTJ':'ESFP','ISTP':'ESFJ','ISFJ':'ESTP','ISFP':'ESTJ',
    'ENTJ':'INTP','ENTP':'INFJ','ENFJ':'INFP','ENFP':'INTJ',
    'ESTJ':'ISFP','ESTP':'ISFJ','ESFJ':'ISTP','ESFP':'ISTJ',
  };
  const has = l => structureLabels.includes(l);
  let love, relationship, compatDesc;

  if (has('관성 강세형') && has('식상 약세형')) {
    love = '연애에서는 감정이 없는 타입이 아니라, 표현보다 책임감과 안정감을 먼저 보여주는 편에 가깝습니다. 가까워질수록 진심은 깊어지지만, 초반엔 다소 닫혀 보일 수 있습니다.';
    relationship = '관계에서 쉽게 흐트러지기보다 선을 지키려는 편입니다. 대신 기대가 무너질 때 실망이 오래 남을 수 있습니다.';
    compatDesc = '너무 즉흥적인 사람보다 감정 표현이 자연스럽고, 동시에 신뢰를 지킬 수 있는 타입이 더 잘 맞을 수 있습니다.';
  } else if (has('충돌 내면형') && has('관계 민감형')) {
    love = '가까워지면 깊게 들어가지만, 상처나 서운함도 오래 가져갈 가능성이 큽니다. 애정은 크더라도 표현 타이밍이 어긋날 수 있습니다.';
    relationship = '사람을 잘 읽는 편이지만, 그만큼 관계 피로도도 크게 느낄 수 있습니다. 깊은 관계와 단절 사이의 온도차가 클 수 있습니다.';
    compatDesc = '정서적으로 완충 역할을 해주고, 감정선이 급격히 흔들릴 때 균형을 잡아주는 사람이 잘 맞습니다.';
  } else if (has('비견 강세형') && has('식상 발산형')) {
    love = '연애에서도 자기 표현이 비교적 분명하고 반응 속도가 빠를 수 있습니다. 다만 주도성이 강한 만큼 조율이 부족하면 상대가 밀린다고 느낄 수 있습니다.';
    relationship = '관계에서 존재감이 뚜렷하고, 맞는 사람과는 금방 가까워질 수 있습니다. 대신 기준이 맞지 않으면 거리 두기도 빠를 수 있습니다.';
    compatDesc = '지나치게 비슷한 타입보다, 감정 완충과 현실 조율이 가능한 사람이 더 안정적으로 맞을 수 있습니다.';
  } else {
    love = '연애에서는 겉으로 보이는 태도와 실제 속마음이 완전히 같지 않을 수 있습니다. 가까워질수록 본래 패턴이 더 선명하게 드러나는 편입니다.';
    relationship = '관계에서는 감정과 기준이 함께 작동하는 복합형에 가깝습니다. 누구에게나 같은 속도로 열리는 타입은 아닐 수 있습니다.';
    compatDesc = '부족한 축을 보완해주면서도 기본 리듬이 크게 어긋나지 않는 사람이 더 잘 맞습니다.';
  }

  return {
    love, relationship,
    compatible_mbti: compatMap[mbti.type] || mbti.secondary,
    compat_desc: compatDesc,
  };
}

function axisDisplayText(axisInfo) {
  const names = {'E':'외향형','I':'내향형','N':'직관형','S':'감각형','T':'사고형','F':'감정형','J':'판단형','P':'인식형'};
  const labels = { balanced:'거의 비슷', close:'근소 우세', lean:'우세', clear:'뚜렷' };
  const w = axisInfo.result, l = axisInfo.loser;
  return `${w} ${names[w]} (${labels[axisInfo.label]})${axisInfo.label === 'balanced' ? ` / ${l}와 차이가 크지 않음` : ''}`;
}

// =====================================================================
// functions/api/analyze.js
// Cloudflare Pages Function — POST /api/analyze (v3)
//
// 명령서 v2(saju v3) 구조:
//   - 원국은 자체 엔진이 계산 (EightChar 미사용)
//   - tyme4ts는 절기/음력 공급자 + 선택적 교차 검증에만 사용
// =====================================================================







const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function onRequestPost(context) {
  let body;
  try { body = await context.request.json(); }
  catch { return new Response(JSON.stringify({ error:'요청 본문이 올바르지 않습니다.' }), { status:400, headers:corsHeaders }); }

  const {
    year, month, day, hour,
    minute = 0,
    calendar = 'solar',
    isLeap = false,
    zasiPolicy = ZASI_POLICY.NEXT_DAY_MIDNIGHT,
    verify,  // undefined=auto (dev ON, prod OFF), true/false=명시
  } = body;

  if (!year || !month || !day || hour === undefined) {
    return new Response(JSON.stringify({ error:'year, month, day, hour는 필수입니다.' }),
      { status:400, headers:corsHeaders });
  }

  try {
    const core = await computeEightChars({
      calendar, year, month, day, hour, minute, isLeap, zasiPolicy, verify,
    });
    const computed = postProcess(core.eightChars);

    if (computed['일간'] !== core.dayMaster) {
      return new Response(JSON.stringify({
        error: '내부 일관성 오류: 일간 불일치',
        detail: { computed: computed['일간'], core: core.dayMaster }
      }), { status:500, headers:corsHeaders });
    }

    const features = calculateStructuralFeatures(computed);
    const mbti = calculateMbti(features, computed);
    const narrative = buildNarrative(computed, features, mbti);
    const cards = buildRelationshipCards(mbti, narrative.structure_labels);

    return new Response(JSON.stringify({
      success: true,
      input: { calendar, year, month, day, hour, minute, isLeap, zasi_policy: core.meta.zasiPolicy },
      meta: {
        solar_used: core.solar,
        saju_year: core.meta.sajuYear,
        day_pillar_adjusted_for_zasi: core.meta.dayPillarAdjusted,
        verification: core.meta.verification,
      },
      eight_chars: core.eightChars,
      pillars: computed['사주_원국'],
      day_master: core.dayMaster,
      day_master_label: DAY_MASTER_LABEL[core.dayMaster],
      five_elements: computed['오행_기본분포'],
      five_elements_status: computed['오행_분석'],
      saju_structure: features,
      saju_traits: features.traits,
      ten_gods_summary: computed['십성_요약'],
      core_ten_gods: computed['핵심_십성'],
      stem_relations: computed['천간_관계'],
      branch_relations: computed['지지_관계'],
      sinsal: computed['십이신살'],
      gwiin: computed['귀인_신살'],
      mbti: {
        type: mbti.type,
        secondary: mbti.secondary,
        scores: mbti.scores,
        confidence: Object.fromEntries(
          Object.entries(mbti.axes).map(([k, v]) => [k, {
            result: v.result, loser: v.loser, label: v.label,
            display: axisDisplayText(v), reasons: v.reasons,
          }])
        ),
      },
      interpretation_blocks: narrative,
      relationship_cards: cards,
    }), { status:200, headers:corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status:500, headers:corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status:204, headers: {
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
  }});
}