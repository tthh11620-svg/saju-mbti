// =====================================================================
// Cloudflare Pages Function — POST /api/analyze
// 결정적 사주 계산 엔진 v2.0
//
// 명령서(analyze.txt) 8개 원칙 적용:
//   1. 1층(결정적 계산) / 2층(해석) 분리
//   2. calibration / signature / 샘플 하드코딩 전면 폐기
//   3. 월주: 12절기 절입 시각 기준 (tyme4ts/sxwnl)
//   4. 연주: 입춘 절입 시각 기준
//   5. 일주: sxwnl 만세력 anchor + KST 명시 + 자시 정책 보정
//   6. 시주: 12지지 매핑/오자둔/자시 옵션 분리
//   7. 음력 입력: 별도 경로(lunarToSolar) → 양력 경로 합류
//   8. 정확도 우선
//
// 의존성: npm i tyme4ts  (sxwnl 알고리즘, 1900~2100 분 단위 정확도)
// =====================================================================

import { SolarTime, LunarDay, LunarHour } from 'tyme4ts';


// =====================================================================
// ganzhi/constants.js
// 천간/지지/오행/지장간 등 정적 상수.
// 1층(결정적 계산)과 2층(해석) 모두에서 import 됨.
// =====================================================================

const CHEONGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JIJI     = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// [오행, 음양(1=양, 0=음)]
const CHAR_INFO = {
  '甲':['목',1],'乙':['목',0],'丙':['화',1],'丁':['화',0],
  '戊':['토',1],'己':['토',0],'庚':['금',1],'辛':['금',0],
  '壬':['수',1],'癸':['수',0],
  '子':['수',0],'丑':['토',0],'寅':['목',1],'卯':['목',0],
  '辰':['토',1],'巳':['화',1],'午':['화',0],'未':['토',0],
  '申':['금',1],'酉':['금',0],'戌':['토',1],'亥':['수',1],
};

const ELEM_IDX   = {'목':0,'화':1,'토':2,'금':3,'수':4};
const ELEM_HANJA = {'목':'木','화':'火','토':'土','금':'金','水':'水','수':'水'};

const DAY_MASTER_LABEL = {
  '甲':'갑목(甲木)','乙':'을목(乙木)','丙':'병화(丙火)','丁':'정화(丁火)','戊':'무토(戊土)',
  '己':'기토(己土)','庚':'경금(庚金)','辛':'신금(辛金)','壬':'임수(壬水)','癸':'계수(癸水)',
};

const JIJANGGAN = {
  '子':['癸'],'丑':['己','癸','辛'],'寅':['甲','丙','戊'],'卯':['乙'],
  '辰':['戊','乙','癸'],'巳':['丙','戊','庚'],'午':['丁','己'],'未':['己','丁','乙'],
  '申':['庚','壬','戊'],'酉':['辛'],'戌':['戊','辛','丁'],'亥':['壬','甲'],
};

const TWELVE_STAGES = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'];
const JANGSEONG_START = {'甲':11,'乙':6,'丙':2,'丁':9,'戊':2,'己':9,'庚':5,'辛':0,'壬':8,'癸':3};
const IS_YANG_GAN = {'甲':true,'乙':false,'丙':true,'丁':false,'戊':true,'己':false,'庚':true,'辛':false,'壬':true,'癸':false};

const GAN_POSITIONS = ['년간','월간','일간','시간'];
const JI_POSITIONS  = ['년지','월지','일지','시지'];

// 합/충/형/파/해
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

// 신살
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

// ─── 자시 정책 옵션 ──────────────────────────────────────────────
// same_day_midnight  : 子時는 23:00에 시작, 23:00에 일주가 다음날로 변경 (전통/sxwnl·tyme4ts 기본)
// next_day_midnight  : 자시는 23:00에 시작하지만 일주는 자정(00:00)에만 변경 (현대 한국 관행, 야자시/조자시 구분)
const ZASI_POLICY = Object.freeze({
  SAME_DAY_MIDNIGHT: 'same_day_midnight',
  NEXT_DAY_MIDNIGHT: 'next_day_midnight',
});
const DEFAULT_ZASI_POLICY = ZASI_POLICY.NEXT_DAY_MIDNIGHT;

// ─── 60갑자 인덱싱 유틸 ─────────────────────────────────────────
function cycleIdxFromChars(stem, branch) {
  const s = CHEONGAN.indexOf(stem);
  const b = JIJI.indexOf(branch);
  if (s < 0 || b < 0) throw new Error(`Invalid stem/branch: ${stem}${branch}`);
  for (let i = 0; i < 60; i++) {
    if (i % 10 === s && i % 12 === b) return i;
  }
  throw new Error(`Invalid 60-cycle pair: ${stem}${branch}`);
}

function cycleIdxToChars(idx) {
  const i = ((idx % 60) + 60) % 60;
  return [CHEONGAN[i % 10], JIJI[i % 12]];
}

// =====================================================================
// calendar/solarTermEngine.js
// 절기 절입 시각 판정 엔진 (tyme4ts 기반).
//
// tyme4ts는 寿星天文历(sxwnl, 许剑伟) 기반으로 1900~2100 절기를
// 분 단위 정확도로 제공한다. KASI/자금산천문대 데이터와 일치.
//
// 명령서 3번: 고정 절입일 배열 금지. 실제 절입 시각으로 판정.
// =====================================================================



/**
 * 입력 양력 datetime이 어느 절기 구간에 속하는지 판정하기 위한
 * 핵심 보조: tyme4ts SolarTime 인스턴스를 만든다.
 *
 * 시간대: 입력은 모두 KST(현지 한국 시간) 기준으로 가정한다.
 * tyme4ts 자체는 timezone-naive하게 동작하므로, 외부에서
 * 항상 KST 벽시계 시각을 그대로 넘긴다.
 */
function makeSolarTime(year, month, day, hour, minute = 0, second = 0) {
  if (year < 1900 || year > 2100) {
    throw new Error(`year out of range (1900~2100): ${year}`);
  }
  return SolarTime.fromYmdHms(year, month, day, hour, minute, second);
}

/**
 * tyme4ts EightChar를 직접 얻는다. 이는 이미
 *   - 입춘 절입 시각 기준 연주
 *   - 12절기 절입 시각 기준 월주
 *   - 일주(전통식 자시 정책: 23시에 일주 변경)
 *   - 시주(子~亥 12지지)
 * 가 모두 적용된 결과다.
 *
 * 이 함수의 결과는 자시 정책이 same_day_midnight일 때의 결과로 간주.
 * next_day_midnight 정책 적용은 ganzhi/dayPillar, hourPillar에서 보정한다.
 */
function getRawEightChar(solarTime) {
  return solarTime.getLunarHour().getSixtyCycleHour().getEightChar();
}

/**
 * 디버깅/검증용: EightChar를 [년간, 년지, 월간, 월지, 일간, 일지, 시간, 시지] 배열로.
 */
function eightCharToArray(ec) {
  return [
    ec.getYear().getHeavenStem().getName(),
    ec.getYear().getEarthBranch().getName(),
    ec.getMonth().getHeavenStem().getName(),
    ec.getMonth().getEarthBranch().getName(),
    ec.getDay().getHeavenStem().getName(),
    ec.getDay().getEarthBranch().getName(),
    ec.getHour().getHeavenStem().getName(),
    ec.getHour().getEarthBranch().getName(),
  ];
}

// =====================================================================
// calendar/lunarConversion.js
// 음력(윤달 포함) → 양력 변환 (tyme4ts 기반).
//
// 명령서 7번: 음력 입력은 별도 경로. 변환과 원국 계산을 한 함수에 섞지 마라.
// =====================================================================



/**
 * 음력 → 양력 datetime 변환.
 *
 * @param {object} input
 * @param {number} input.year   음력 연도
 * @param {number} input.month  음력 월 (1~12). 윤달은 isLeap=true로 표시
 * @param {number} input.day    음력 일
 * @param {boolean} [input.isLeap=false]  윤달 여부
 * @param {number} input.hour
 * @param {number} [input.minute=0]
 *
 * @returns {{year, month, day, hour, minute}} 양력 KST datetime
 */
function lunarToSolar({ year, month, day, isLeap = false, hour, minute = 0 }) {
  if (year < 1900 || year > 2100) {
    throw new Error(`year out of range (1900~2100): ${year}`);
  }
  if (month < 1 || month > 12) {
    throw new Error(`lunar month must be 1~12 (use isLeap for 윤달): ${month}`);
  }
  // tyme4ts 규약: 윤달은 음수 month로 표기 (-2 = 윤2월)
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

/**
 * 음력 datetime으로부터 직접 EightChar를 얻는 경로.
 * 양력 변환 → 사주 계산을 한 번에 하지만, 의미상 두 단계가 분리되어 있음을 명시.
 *
 * 사주 계산 본체에서는 lunarToSolar()로 양력 변환 → coreEngine 경로를 권장.
 * 이 함수는 검증/디버깅용 보조.
 */
function lunarHourEightChar({ year, month, day, isLeap = false, hour, minute = 0 }) {
  const tymeMonth = isLeap ? -month : month;
  return LunarHour.fromYmdHms(year, tymeMonth, day, hour, minute, 0)
    .getSixtyCycleHour()
    .getEightChar();
}

// =====================================================================
// ganzhi/yearPillar.js
// 연주 계산 — 입춘 절입 시각 기준.
//
// 명령서 4번: 1월 1일 또는 2월 4일 고정 규칙 금지. 실제 입춘 절입 시각 기준.
//
// 실제 절입 시각 판정은 tyme4ts(sxwnl 알고리즘)에 위임한다.
// 이 모듈은 그 결과의 "연주" 부분을 추출 + 검증하는 책임만 가진다.
// =====================================================================



/**
 * tyme4ts EightChar로부터 연주를 추출.
 *
 * @returns {{stem, branch, pillar, cycleIdx}}
 */
function extractYearPillar(ec) {
  const sc = ec.getYear();
  const stem = sc.getHeavenStem().getName();
  const branch = sc.getEarthBranch().getName();
  return {
    stem,
    branch,
    pillar: `${stem}${branch}`,
    cycleIdx: cycleIdxFromChars(stem, branch),
  };
}

// =====================================================================
// ganzhi/monthPillar.js
// 월주 계산 — 12절기 절입 시각 기준.
//
// 명령서 3번:
//   - 고정 절입일 배열 금지
//   - month/day 단순 비교 금지
//   - getMonthIdx() 류의 근사 함수 금지
//   - 실제 절기 절입 시각 기준으로 월지 산출
//
// 실제 절기 시각 판정은 tyme4ts(sxwnl)에 위임. 이 모듈은 추출만 한다.
// =====================================================================



function extractMonthPillar(ec) {
  const sc = ec.getMonth();
  const stem = sc.getHeavenStem().getName();
  const branch = sc.getEarthBranch().getName();
  return {
    stem,
    branch,
    pillar: `${stem}${branch}`,
    cycleIdx: cycleIdxFromChars(stem, branch),
  };
}

// =====================================================================
// ganzhi/dayPillar.js
// 일주 계산 — anchor 기반, 자시 정책 적용.
//
// 명령서 5번:
//   - anchor 방식 사용 가능하되 기준점 재검증
//   - UTC/로컬 날짜 경계 문제 없도록
//   - 한국 시간 기준 날짜 변경이 일주에 미치는 영향 검토
//   - 자시 처리 옵션과 일주 변경 로직이 충돌하지 않게
//
// 구현 전략:
//   - 결정적 anchor 계산 자체는 tyme4ts(검증된 sxwnl 만세력)에 위임.
//   - tyme4ts 기본 정책은 same_day_midnight (23:00에 일주 변경, 전통식).
//   - 사용자 자시 정책이 next_day_midnight이면, 23:00~23:59 구간에서
//     일주를 전날로 1 빼는 보정을 한다(시주는 hourPillar에서 별도 처리).
// =====================================================================



/**
 * @param {object} ec        tyme4ts EightChar
 * @param {number} hour      0~23 (KST)
 * @param {string} policy    ZASI_POLICY.*
 */
function extractDayPillar(ec, hour, policy) {
  const sc = ec.getDay();
  const rawStem = sc.getHeavenStem().getName();
  const rawBranch = sc.getEarthBranch().getName();
  const rawIdx = cycleIdxFromChars(rawStem, rawBranch);

  let cycleIdx = rawIdx;

  // next_day_midnight 정책: tyme4ts는 이미 23:00에 일주를 다음날로 넘겼음.
  // 한국 현대 관행에서는 23:00~23:59는 아직 같은 날이므로 1 되돌린다.
  if (policy === ZASI_POLICY.NEXT_DAY_MIDNIGHT && hour === 23) {
    cycleIdx = ((rawIdx - 1) % 60 + 60) % 60;
  }

  const [stem, branch] = cycleIdxToChars(cycleIdx);
  return {
    stem,
    branch,
    pillar: `${stem}${branch}`,
    cycleIdx,
    rawCycleIdx: rawIdx,           // 검증용
    adjusted: cycleIdx !== rawIdx, // 자시 보정 발생 여부
  };
}

// =====================================================================
// ganzhi/hourPillar.js
// 시주 계산 — 자시 처리 정책 옵션 포함.
//
// 명령서 6번:
//   - 12지지 시각 매핑 분리
//   - 시간대 판정 함수 분리
//   - 일간 기반 시간 천간 계산 분리
//   - 자시 처리 정책 옵션화
//
// 시주 천간은 일간으로부터 결정되므로, dayPillar에서 자시 보정이
// 일어났다면 시주의 천간도 그 보정된 일간 기준으로 계산되어야 한다.
// =====================================================================



/**
 * 1. 시각(0~23) → 12지지 인덱스 매핑.
 *    子時 = 23:00~00:59 (인덱스 0)
 *    丑時 = 01:00~02:59 (1)
 *    ...
 *    亥時 = 21:00~22:59 (11)
 *
 * 자시 정책이 무엇이든 "지지 매핑"은 동일하다. 정책은 일주 변경 시점만 결정.
 */
function hourToBranchIdx(hour) {
  if (hour < 0 || hour > 23) throw new Error(`hour out of range: ${hour}`);
  if (hour === 23) return 0;
  return Math.floor((hour + 1) / 2);
}

/**
 * 2. 일간 + 시지 → 시주 천간.
 *    오자둔(五子遁) 규칙:
 *      甲己日 → 子時 = 甲子
 *      乙庚日 → 子時 = 丙子
 *      丙辛日 → 子時 = 戊子
 *      丁壬日 → 子時 = 庚子
 *      戊癸日 → 子時 = 壬子
 *
 *    그 다음은 천간이 1씩 증가하면서 12지지 순회.
 *    공식: hourStemIdx = (dayStemIdx % 5 * 2 + branchIdx) % 10
 */
function hourStemIdxFromDay(dayStemChar, hourBranchIdx) {
  const dayStemIdx = CHEONGAN.indexOf(dayStemChar);
  if (dayStemIdx < 0) throw new Error(`Invalid day stem: ${dayStemChar}`);
  const startStem = (dayStemIdx % 5) * 2;
  return (startStem + hourBranchIdx) % 10;
}

/**
 * 3. 최종 시주 = (일간 + 시각) 조합.
 *    자시 정책 적용된 dayPillar 결과(보정된 일간)를 받아서 처리한다.
 *    그래서 23:00~23:59 next_day_midnight 케이스에서도 시주 천간이 일치.
 */
function computeHourPillar(adjustedDayStem, hour) {
  const branchIdx = hourToBranchIdx(hour);
  const stemIdx = hourStemIdxFromDay(adjustedDayStem, branchIdx);
  const stem = CHEONGAN[stemIdx];
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
// 1층: 결정적 사주 8자 계산 엔진.
//
// 명령서 1번: 같은 입력이면 언제나 같은 결과. 샘플 보정/감성 해석 일절 없음.
// 명령서 7번: 양력/음력 입력 경로 분리.
//
// 입력 → [년간,년지,월간,월지,일간,일지,시간,시지] (8문자)
// =====================================================================









/**
 * @typedef {Object} SajuInput
 * @property {'solar'|'lunar'} calendar  입력 달력 종류
 * @property {number} year
 * @property {number} month   양력 1~12 또는 음력 1~12
 * @property {number} day
 * @property {number} hour    0~23 (KST)
 * @property {number} [minute=0]
 * @property {boolean} [isLeap=false]    음력 윤달 여부
 * @property {string} [zasiPolicy]       ZASI_POLICY.* (기본: NEXT_DAY_MIDNIGHT)
 */

/**
 * @returns {{
 *   pillars: {year, month, day, hour},
 *   eightChars: string[8],          // [년간,년지,월간,월지,일간,일지,시간,시지]
 *   dayMaster: string,              // 일간
 *   solar: {year,month,day,hour,minute},
 *   meta: { zasiPolicy, dayPillarAdjusted, calendarSource }
 * }}
 */
function computeEightChars(input) {
  const policy = input.zasiPolicy || DEFAULT_ZASI_POLICY;
  if (!Object.values(ZASI_POLICY).includes(policy)) {
    throw new Error(`Unknown zasiPolicy: ${policy}`);
  }

  // ─── 1. 입력 → 양력 KST datetime ───────────────────────────
  let solar;
  if (input.calendar === 'lunar') {
    solar = lunarToSolar({
      year: input.year,
      month: input.month,
      day: input.day,
      isLeap: !!input.isLeap,
      hour: input.hour,
      minute: input.minute ?? 0,
    });
  } else if (input.calendar === 'solar' || input.calendar === undefined) {
    solar = {
      year: input.year, month: input.month, day: input.day,
      hour: input.hour, minute: input.minute ?? 0,
    };
  } else {
    throw new Error(`Unknown calendar: ${input.calendar}`);
  }

  // ─── 2. 양력 datetime → tyme4ts EightChar ──────────────────
  //   이 시점에서 입춘/절기 절입은 모두 sxwnl 계산으로 처리됨
  const st = makeSolarTime(solar.year, solar.month, solar.day, solar.hour, solar.minute, 0);
  const ec = getRawEightChar(st);

  // ─── 3. 4주 추출 + 자시 정책 적용 ──────────────────────────
  const yp = extractYearPillar(ec);
  const mp = extractMonthPillar(ec);
  const dp = extractDayPillar(ec, solar.hour, policy);

const hourDayStem =
  policy === ZASI_POLICY.NEXT_DAY_MIDNIGHT && solar.hour === 23
    ? ec.getDay().getHeavenStem().getName()   // raw next-day stem
    : dp.stem;

const hp = computeHourPillar(hourDayStem, solar.hour);
  const eightChars = [
    yp.stem, yp.branch,
    mp.stem, mp.branch,
    dp.stem, dp.branch,
    hp.stem, hp.branch,
  ];

  return {
    pillars: { year: yp, month: mp, day: dp, hour: hp },
    eightChars,
    dayMaster: dp.stem,
    solar,
    meta: {
      zasiPolicy: policy,
      dayPillarAdjusted: dp.adjusted,
      calendarSource: input.calendar || 'solar',
      tymeRawEightChar: eightCharToArray(ec), // 검증용 raw
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
// analysis/mbti.js
// 2층(해석): MBTI 추정.
//
// 명령서 2번: calibration 전면 폐기.
//   - applySampleCalibration() 함수 제거
//   - getCalibrationSignature() 함수 제거
//   - 특정 사주(signature)에 대한 분기 제거
//   - 점수 보정으로 결과 뒤집기 제거
//
// 같은 입력이면 같은 점수 → 같은 MBTI. 어떤 샘플도 이 모듈에 영향을 주지 않는다.
// =====================================================================



const round2 = n => Math.round(n * 100) / 100;

// ─── 구조 feature 계산 (MBTI 전용 사전 처리) ────────────────────
function dayMasterStrength(computed) {
  const { MONTH_BRANCH_BOOST, ELEM_IDX } = computedConsts();
  const dayGan = computed['일간'];
  const dayElem = CHAR_INFO[dayGan][0];
  const monthBranch = computed['사주_원국']['월주'][1];
  const monthBoost = MONTH_BRANCH_BOOST[monthBranch];
  const ten = computed['십성_요약'];
  const oh = computed['오행_기본분포'];
  const hidden = computed['지장간_십성'];
  const tg = n => ten[n] || 0;
  const elem = n => oh[n] || 0;

  let score = 0;
  if (monthBoost === dayElem) score += 2.4;
  if ((ELEM_IDX[monthBoost] + 1) % 5 === ELEM_IDX[dayElem]) score += 1.0;

  score += tg('비견')*1.2 + tg('겁재')*0.9 + tg('정인')*1.0 + tg('편인')*0.8;
  score -= tg('식신')*0.45 + tg('상관')*0.55 + tg('정재')*0.45 + tg('편재')*0.45 + tg('정관')*0.55 + tg('편관')*0.65;
  score += elem(dayElem) * 0.35;
  for (const pos of Object.keys(hidden)) {
    if (hidden[pos].장간.map(([g])=>g).includes(dayGan)) score += 0.8;
  }
  let label = '중화';
  if (score >= 4.1) label = '신강';
  else if (score <= 1.2) label = '신약';
  return { score: round2(score), label };
}
function computedConsts() {
  // 순환 import 회피용 inline
  return {
    MONTH_BRANCH_BOOST: {
      '寅':'목','卯':'목','辰':'토','巳':'화','午':'화','未':'토',
      '申':'금','酉':'금','戌':'토','亥':'수','子':'수','丑':'토',
    },
    ELEM_IDX: {'목':0,'화':1,'토':2,'금':3,'수':4},
  };
}

function relationFeatures(computed) {
  const all = [...computed['천간_관계'], ...computed['지지_관계']];
  const chong = all.filter(r => String(r.type).includes('충'));
  const hap   = all.filter(r => String(r.type).includes('합'));
  const hyung = computed['지지_관계'].filter(r => String(r.type).includes('형'));
  const pa    = computed['지지_관계'].filter(r => String(r.type).includes('파'));
  const hae   = computed['지지_관계'].filter(r => String(r.type).includes('해'));
  const conflictLevel = chong.length*1.4 + hyung.length*1.0 + pa.length*0.8 + hae.length*0.5;
  return {
    chongCount: chong.length, hapCount: hap.length, hyungCount: hyung.length,
    paCount: pa.length, haeCount: hae.length,
    conflictLevel: round2(conflictLevel),
    stabilityLevel: round2(hap.length * 1.0),
  };
}

function calculateStructuralFeatures(computed) {
  const ten = computed['십성_요약'];
  const oh  = computed['오행_기본분포'];
  const dmStrength = dayMasterStrength(computed);
  const rel = relationFeatures(computed);
  const tg = n => ten[n] || 0;
  const elem = n => oh[n] || 0;
  const ec = n => Math.min(elem(n), 2);

  const selfDrive = tg('비견')*1.35 + tg('겁재')*1.1 + (dmStrength.label === '신강' ? 0.8 : 0);
  const expressionDrive = tg('식신')*1.2 + tg('상관')*1.3 + ec('화')*0.20 + ec('수')*0.15;
  const supportDrive = tg('정인')*1.4 + tg('편인')*1.1 + ec('금')*0.20;
  const controlDrive = tg('정관')*1.6 + tg('편관')*1.3 + ec('토')*0.25 + ec('금')*0.15;
  const realityFocus = tg('식신')*0.6 + tg('정재')*0.8 + tg('편재')*0.7 + tg('정관')*0.55 + ec('토')*0.40 + ec('금')*0.30;
  const abstractionFocus = tg('편인')*0.8 + tg('상관')*0.65 + tg('정인')*0.25 + ec('수')*0.40 + ec('목')*0.30;
  const relationalSensitivity = tg('정인')*0.7 + tg('식신')*0.4 + ec('수')*0.40 + ec('목')*0.25;
  const emotionalContainment = tg('정관')*0.8 + tg('편관')*0.7 + tg('정인')*0.55 + rel.conflictLevel*0.35;
  const flexibility = tg('식신')*0.6 + tg('상관')*0.85 + ec('수')*0.30 + rel.chongCount*0.7;
  const structureNeed = tg('정관')*1.2 + tg('정인')*0.8 + ec('토')*0.25 + ec('금')*0.15;
  const internalConflict = rel.conflictLevel*1.0 + emotionalContainment*0.25;

  // 십이운성 에너지
  const STAGE_E = {'제왕':2,'건록':2,'장생':1,'관대':1,'양':0,'태':0,'목욕':-1,'쇠':-1,'병':-1,'사':-2,'묘':-2,'절':-2};
  const stages = computed['십이운성'];
  const stageEnergy = Object.values(stages).map(s => STAGE_E[s] ?? 0).reduce((a,b)=>a+b, 0);
  const dayBranchStageEnergy = STAGE_E[stages['일지']] ?? 0;

  return {
    dayMasterStrengthScore: dmStrength.score,
    dayMasterStrengthLabel: dmStrength.label,
    selfDrive: round2(selfDrive),
    expressionDrive: round2(expressionDrive),
    supportDrive: round2(supportDrive),
    controlDrive: round2(controlDrive),
    realityFocus: round2(realityFocus),
    abstractionFocus: round2(abstractionFocus),
    relationalSensitivity: round2(relationalSensitivity),
    emotionalContainment: round2(emotionalContainment),
    flexibility: round2(flexibility),
    structureNeed: round2(structureNeed),
    internalConflict: round2(internalConflict),
    conflictLevel: rel.conflictLevel,
    stabilityLevel: rel.stabilityLevel,
    chongCount: rel.chongCount,
    stageEnergy,
    dayBranchStageEnergy,
  };
}

// ─── MBTI 4축 점수 ────────────────────────────────────────────────
function labelByGap(gap) {
  if (gap < 0.30) return 'balanced';
  if (gap < 0.90) return 'close';
  if (gap < 1.60) return 'lean';
  return 'clear';
}

function axisReasonPack(axisKey, winner, dm) {
  const pack = {
    'E/I': {
      E: ['자기주도성과 바깥으로 반응하는 힘이 비교적 큰 편입니다.',
          '혼자만 축적하기보다 상호작용 속에서 에너지가 움직일 가능성이 큽니다.'],
      I: ['겉으로 바로 움직이기보다 관찰과 내부 정리를 먼저 거치는 쪽에 가깝습니다.',
          '표현이 적어서가 아니라, 생각과 감정이 안에서 오래 가공된 뒤 밖으로 나오는 구조입니다.'],
    },
    'N/S': {
      N: ['정보를 그대로 받기보다 의미와 흐름으로 재해석하려는 성향이 있습니다.',
          `${DAY_MASTER_LABEL[dm]}의 성향과 수/인성 계열이 겹치면 심리나 맥락을 더 읽으려는 쪽으로 기웁니다.`],
      S: ['추상적 가능성보다 실제 상황과 구체 조건을 먼저 보는 편입니다.',
          '상상력 자체보다 현실 판단과 관찰력이 더 앞에 나오는 구조입니다.'],
    },
    'T/F': {
      T: ['판단할 때 감정보다 기준과 정리, 맞고 틀림을 먼저 보려는 경향이 있습니다.',
          '관계를 무시한다기보다 최종 결론은 정리와 기준 쪽으로 가는 편입니다.'],
      F: ['판단에서 감정에 휘둘린다기보다, 사람 사이의 온도와 맥락을 실제로 중요하게 반영하는 구조입니다.',
          '겉으로는 이성적으로 보여도 속에서는 관계 반응과 감정선이 꽤 크게 작동할 수 있습니다.'],
    },
    'J/P': {
      J: ['미리 정리하고 예측 가능한 틀 안에서 움직일 때 더 편할 가능성이 큽니다.',
          '유연 대응을 하더라도 내부 기준이나 정리 욕구는 강하게 살아 있는 편입니다.'],
      P: ['고정된 계획보다 상황 변화에 따라 수정하며 움직이는 쪽이 더 편할 수 있습니다.',
          '통제 욕구가 아주 약한 건 아니지만, 현장 반응이 계획보다 앞설 수 있습니다.'],
    },
  };
  return pack[axisKey][winner];
}

function buildAxis(axisKey, a, b, aScore, bScore, dm) {
  const winner = aScore >= bScore ? a : b;
  const loser  = winner === a ? b : a;
  const gap = Math.abs(aScore - bScore);
  return {
    result: winner,
    loser,
    label: labelByGap(gap),
    scores: { [a]: round2(aScore), [b]: round2(bScore) },
    reasons: axisReasonPack(axisKey, winner, dm),
  };
}

/**
 * MBTI 추정.
 * 명령서 2번에 따라 calibration / signature / 샘플별 분기 일절 없음.
 * 일간 본질, 십성 분포, 오행, 구조 feature, 12운성만으로 결정적 산출.
 */
function calculateMbti(features, computed) {
  const ten = computed['십성_요약'];
  const oh  = computed['오행_기본분포'];
  const dm  = computed['일간'];
  const tg = n => ten[n] || 0;
  const el = n => oh[n] || 0;
  const ec = n => Math.min(el(n), 2);

  const sik = tg('식신'), sang = tg('상관');
  const pyJae = tg('편재'), jJae = tg('정재');
  const pyGwan = tg('편관'), jGwan = tg('정관');
  const pyIn = tg('편인'), jIn = tg('정인');
  const biGyeop = tg('비견') + tg('겁재');
  const dayElem = CHAR_INFO[dm][0];
  const isYangGan = ['甲','丙','戊','庚','壬'].includes(dm);
  const sinYak  = features.dayMasterStrengthLabel === '신약';
  const sinGang = features.dayMasterStrengthLabel === '신강';
  const lowExpression = (sik + sang) <= 1;
  const highSupport   = (jIn + pyIn) >= 2;
  const strongAnalysisIn = pyIn >= 2;

  // ============ E / I ============
  const expressionRatio = (sik + sang) / Math.max(biGyeop, 1);
  const selfToE = expressionRatio >= 1.0 ? 0.30 : 0.15;
  let eScore = features.selfDrive*selfToE + features.expressionDrive*0.30 + features.flexibility*0.14;
  let iScore = features.supportDrive*0.42 + features.emotionalContainment*0.32 + features.internalConflict*0.22 + features.structureNeed*0.10;
  if (isYangGan && !sinYak) eScore += 0.25;
  if (isYangGan && sinYak)  eScore += 0.08;
  if (lowExpression) iScore += 0.80;
  if (highSupport)   iScore += 0.25;
  if (sinYak)        iScore += 0.20;
  if (dm === '癸' || dm === '丁') iScore += 0.20;
  if (biGyeop >= 3 && (sik + sang) <= 2) iScore += 0.40;

  // ============ N / S ============
  const pyInToN = { '목':1.10,'화':0.95,'토':0.70,'금':0.20,'수':0.50 }[dayElem];
  const pyInToS = { '목':0.00,'화':0.00,'토':0.10,'금':0.65,'수':0.10 }[dayElem];
  const pyInToT = { '목':0.10,'화':0.10,'토':0.20,'금':0.30,'수':0.55 }[dayElem];
  let nScore = pyIn*pyInToN + sang*0.70 + jIn*0.20 + sik*0.12;
  let sScore = pyIn*pyInToS + sik*0.50 + pyJae*0.55 + jJae*0.55 + jGwan*0.50 + pyGwan*0.15;
  const pyInIsN = ['목','화','토'].includes(dayElem);
  if (pyInIsN && sinYak  && strongAnalysisIn) nScore += 1.0;
  if (pyInIsN && sinGang && strongAnalysisIn) nScore += 0.55;
  if (pyInIsN && strongAnalysisIn && jGwan === 0) nScore += 0.50;
  if (dayElem === '금' && strongAnalysisIn) sScore += 0.50;
  if (sinGang && jGwan >= 1 && sik >= 1) sScore += 0.3;

  // ============ T / F ============
  let tScore = pyIn*pyInToT + pyJae*0.50 + jJae*0.30 + pyGwan*0.55;
  let fScore = jIn*0.95 + sik*0.40 + sang*0.30 + features.relationalSensitivity*0.15;
  if (dayElem === '수' && strongAnalysisIn) tScore += 0.40;
  const metalSoftened = (sik + sang) >= 3;

  // ============ J / P ============
  const cappedStruct  = Math.min(features.structureNeed, 4.0);
  const cappedControl = Math.min(features.controlDrive, 4.5);
  const cappedEmotional = Math.min(features.emotionalContainment, 3.5);
  let jScore = cappedStruct*0.46 + cappedControl*0.26 + cappedEmotional*0.22 + features.stabilityLevel*0.12 + jGwan*0.20;
  let pScore = features.flexibility*0.32 + features.expressionDrive*0.20 + features.conflictLevel*0.12 + sang*0.25 + sik*0.12 + pyIn*0.10;
  if ((jGwan + pyGwan) >= 4) jScore += 0.30;
  if (lowExpression) jScore += 0.12;
  if (sinGang && (jGwan + pyGwan) >= 2 && features.conflictLevel >= 2.0) jScore += 0.20;
  if (biGyeop >= 3 && (jGwan + pyGwan) <= 1) pScore += 0.40;
  if ((jGwan + pyGwan) >= 3 && (sik + sang) >= 3) pScore += 0.30;

  // ============ 일간 본질 4축 보정 (calibration 아님 — 일간별 결정적 가중치) ============
  switch (dm) {
    case '甲': eScore+=0.55; iScore-=0.25; tScore+=0.20; jScore+=0.40; pScore-=0.20; break;
    case '乙': fScore+=0.55; tScore-=0.30; pScore+=0.50; jScore-=0.25; nScore+=0.25; sScore-=0.15; break;
    case '丙': eScore+=0.35; iScore-=0.12; nScore+=0.50; sScore-=0.35; pScore+=0.30; break;
    case '丁': iScore+=0.45; eScore-=0.20; fScore+=0.55; tScore-=0.30; nScore+=0.40; sScore-=0.25; break;
    case '戊': sScore+=0.65; nScore-=0.35; jScore+=0.50; pScore-=0.25; break;
    case '己': sScore+=0.45; nScore-=0.25; fScore+=0.20; break;
    case '庚': tScore += metalSoftened ? 0.25 : 0.60; fScore-=0.30; sScore+=0.35; jScore+=0.30; break;
    case '辛': tScore += metalSoftened ? 0.18 : 0.45; fScore-=0.20; iScore+=0.35; eScore-=0.15; sScore+=0.20; break;
    case '壬': nScore+=0.65; sScore-=0.40; pScore+=0.50; jScore-=0.25; eScore+=0.25; break;
    case '癸': iScore+=0.50; eScore-=0.30; nScore+=0.55; sScore-=0.35; fScore+=0.30; tScore-=0.15; break;
  }
  if ((dm === '庚' || dm === '辛') && el('수') >= 2) fScore += 0.40;

  // ============ 12운성 보정 ============
  const se = features.stageEnergy || 0;
  const dbse = features.dayBranchStageEnergy || 0;
  if (se > 0) { eScore += se*0.07; sScore += se*0.05; }
  else if (se < 0) { iScore += Math.abs(se)*0.07; nScore += Math.abs(se)*0.05; }
  if (dbse >= 2) { eScore += 0.35; sScore += 0.25; jScore += 0.15; }
  else if (dbse === 1) { eScore += 0.15; sScore += 0.10; }
  else if (dbse === -1) { iScore += 0.15; pScore += 0.10; }
  else if (dbse <= -2) { iScore += 0.35; nScore += 0.25; pScore += 0.15; }

  // ─── 결정적 raw score (calibration 없음) ───
  const s = {
    E: round2(eScore), I: round2(iScore),
    N: round2(nScore), S: round2(sScore),
    T: round2(tScore), F: round2(fScore),
    J: round2(jScore), P: round2(pScore),
  };

  const axes = {
    'E/I': buildAxis('E/I','E','I', s.E, s.I, dm),
    'N/S': buildAxis('N/S','N','S', s.N, s.S, dm),
    'T/F': buildAxis('T/F','T','F', s.T, s.F, dm),
    'J/P': buildAxis('J/P','J','P', s.J, s.P, dm),
  };
  const type = `${axes['E/I'].result}${axes['N/S'].result}${axes['T/F'].result}${axes['J/P'].result}`;

  // 2순위(가장 근소했던 축을 뒤집은 결과)
  const closest = Object.entries(axes)
    .map(([k, info]) => ({ k, gap: Math.abs(Object.values(info.scores)[0] - Object.values(info.scores)[1]) }))
    .sort((a,b) => a.gap - b.gap)[0];
  const chars = type.split('');
  const idxMap = { 'E/I':0,'N/S':1,'T/F':2,'J/P':3 };
  const [a,b] = closest.k.split('/');
  chars[idxMap[closest.k]] = chars[idxMap[closest.k]] === a ? b : a;
  const secondary = chars.join('');

  return { type, secondary, scores: s, axes };
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
// Cloudflare Pages Function — POST /api/analyze
//
// 명령서 1번: 이 핸들러는 1층(coreEngine + postProcess)과 2층(mbti + interpretation)을
// 호출만 한다. 보정/계산/분기 일절 없음. 얇은 어댑터.
// =====================================================================







const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(
      JSON.stringify({ error:'요청 본문이 올바르지 않습니다.' }),
      { status:400, headers:corsHeaders }
    );
  }

  // ─── 입력 정규화 ────────────────────────────────────────────
  const {
    year, month, day, hour,
    minute = 0,
    calendar = 'solar',     // 'solar' | 'lunar'
    isLeap = false,         // 음력 윤달
    zasiPolicy = ZASI_POLICY.NEXT_DAY_MIDNIGHT,
  } = body;

  if (!year || !month || !day || hour === undefined) {
    return new Response(
      JSON.stringify({ error:'year, month, day, hour는 필수입니다.' }),
      { status:400, headers:corsHeaders }
    );
  }

  try {
    // ─── 1층: 결정적 계산 ─────────────────────────────────────
    const core = computeEightChars({
      calendar, year, month, day, hour, minute, isLeap, zasiPolicy,
    });
    const computed = postProcess(core.eightChars);

    // 일관성 자체검증 (이중 안전망)
    if (computed['일간'] !== core.dayMaster) {
      return new Response(
        JSON.stringify({ error: '내부 일관성 오류: 일간 불일치', detail: { computed: computed['일간'], core: core.dayMaster }}),
        { status:500, headers:corsHeaders }
      );
    }

    // ─── 2층: 해석 ────────────────────────────────────────────
    const features = calculateStructuralFeatures(computed);
    const mbti = calculateMbti(features, computed);
    const narrative = buildNarrative(computed, features, mbti);
    const cards = buildRelationshipCards(mbti, narrative.structure_labels);

    return new Response(JSON.stringify({
      success: true,
      input: {
        calendar, year, month, day, hour, minute, isLeap,
        zasi_policy: core.meta.zasiPolicy,
      },
      meta: {
        solar_used: core.solar,
        day_pillar_adjusted_for_zasi: core.meta.dayPillarAdjusted,
        tyme_raw_eight_char: core.meta.tymeRawEightChar,
      },
      eight_chars: core.eightChars,
      pillars: computed['사주_원국'],
      day_master: core.dayMaster,
      day_master_label: DAY_MASTER_LABEL[core.dayMaster],
      five_elements: computed['오행_기본분포'],
      five_elements_status: computed['오행_분석'],
      saju_structure: features,
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
            result: v.result,
            loser: v.loser,
            label: v.label,
            display: axisDisplayText(v),
            reasons: v.reasons,
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