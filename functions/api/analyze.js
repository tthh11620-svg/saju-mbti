// Cloudflare Pages Function — POST /api/analyze
// 정확도 중심 규칙 기반 사주 + 구조 해석 + MBTI 도출

// =====================================================================
// 1. 상수
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

const DAY_MASTER_TONE = {
  '甲':'곧게 밀고 나가는 추진력과 방향성이 강한 편',
  '乙':'유연하고 조율 감각이 있으며 관계 흐름을 잘 읽는 편',
  '丙':'표현력이 좋고 에너지가 바깥으로 잘 드러나는 편',
  '丁':'섬세하고 집중력이 있으며 감정 온도를 세밀하게 다루는 편',
  '戊':'중심과 기준을 지키려는 힘이 크고 안정감이 있는 편',
  '己':'현실감각이 좋고 세심하며 꾸준히 쌓아가는 편',
  '庚':'결단력과 직선성이 있고 기준이 분명한 편',
  '辛':'정교하고 예민하며 완성도와 디테일을 중시하는 편',
  '壬':'유연하고 넓게 보며 변화 흐름을 읽는 편',
  '癸':'섬세하고 관찰력이 좋으며 내면 감수성이 깊은 편',
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

const CHEONGAN_HAP  = [['甲','己','토'],['乙','庚','금'],['丙','辛','수'],['丁','壬','목'],['戊','癸','화']];
const CHEONGAN_CHUNG= [['甲','庚'],['乙','辛'],['丙','壬'],['丁','癸']];
const YUKAP  = [['子','丑','토'],['寅','亥','목'],['卯','戌','화'],['辰','酉','금'],['巳','申','수'],['午','未','화']];
const CHUNG  = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']];
const SAMHAP = [[['申','子','辰'],'수'],[['亥','卯','未'],'목'],[['寅','午','戌'],'화'],[['巳','酉','丑'],'금']];
const BANGHAP= [[['寅','卯','辰'],'목'],[['巳','午','未'],'화'],[['申','酉','戌'],'금'],[['亥','子','丑'],'수']];
const HYUNG3 = [['寅','巳','申'],['丑','戌','未']];
const HYUNG2 = [['子','卯']];
const JAHYUNG= new Set(['辰','午','酉','亥']);
const PA  = [['子','酉'],['卯','午'],['寅','亥'],['巳','申'],['辰','丑'],['戌','未']];
const HAE = [['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']];

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

// 월지 계절감 간단 반영
const MONTH_BRANCH_BOOST = {
  '寅':'목','卯':'목','辰':'토',
  '巳':'화','午':'화','未':'토',
  '申':'금','酉':'금','戌':'토',
  '亥':'수','子':'수','丑':'토',
};

// 관계 해석용
const CONFLICT_MEANING = {
  '子午':'감정과 행동의 온도차가 커질 수 있는 구조',
  '寅申':'환경 적응과 자기 방향성 사이의 충돌이 생기기 쉬운 구조',
  '卯酉':'관계 예민도와 표현 방식의 마찰이 생기기 쉬운 구조',
  '辰戌':'안정과 변화 욕구가 부딪히는 구조',
  '巳亥':'직감과 현실 판단이 엇갈릴 수 있는 구조',
  '丑未':'책임과 감정 부담이 동시에 쌓일 수 있는 구조',
};

// =====================================================================
// 2. 공통 유틸
// =====================================================================
function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }

function dedupeList(items, keys) {
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
  return arr.reduce((acc, v) => {
    acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {});
}

function mostCommon(obj, n) {
  return Object.fromEntries(
    Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0, n)
  );
}

// =====================================================================
// 3. 날짜 → 사주 8자
// =====================================================================
function utcDaysDiff(year, month, day) {
  const target = Date.UTC(year, month - 1, day);
  const ref    = Date.UTC(2000, 0, 1);
  return Math.round((target - ref) / 86400000);
}

function cycleToChars(idx) {
  idx = ((idx % 60) + 60) % 60;
  return [CHEONGAN[idx % 10], JIJI[idx % 12]];
}

function findCyclePos(stemIdx, branchIdx) {
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stemIdx && i % 12 === branchIdx) return i;
  }
  return 0;
}

function getYearPillar(year, month, day) {
  let sajuYear = year;
  if (month < 2 || (month === 2 && day < 4)) sajuYear--;
  const cycleIdx = ((sajuYear - 2024 + 40) % 60 + 60) % 60;
  return { cycleIdx, chars: cycleToChars(cycleIdx) };
}

function getMonthIdx(month, day) {
  const starts = [[2,4],[3,6],[4,5],[5,6],[6,6],[7,7],[8,7],[9,8],[10,8],[11,7],[12,7],[1,6]];
  for (let i = starts.length - 1; i >= 0; i--) {
    const [sm, sd] = starts[i];
    if (i === 11) {
      if ((month === 1 && day >= 6) || (month === 12 && day >= 999)) return 11;
    } else {
      if (month > sm || (month === sm && day >= sd)) return i;
    }
  }
  return 10;
}

function getMonthPillar(year, month, day, yearCycleIdx) {
  const monthIdx = getMonthIdx(month, day);
  const yearStemIdx = yearCycleIdx % 10;
  const startStemIdx = ((yearStemIdx % 5) * 2 + 2) % 10;
  const monthStemIdx = (startStemIdx + monthIdx) % 10;
  const monthBranchIdx = (2 + monthIdx) % 12;
  const cycleIdx = findCyclePos(monthStemIdx, monthBranchIdx);
  return { cycleIdx, chars: cycleToChars(cycleIdx) };
}

function getDayPillar(year, month, day) {
  const REF_IDX = 50;
  const diff = utcDaysDiff(year, month, day);
  const cycleIdx = ((REF_IDX + diff) % 60 + 60) % 60;
  return { cycleIdx, chars: cycleToChars(cycleIdx) };
}

function getHourPillar(dayCycleIdx, hour) {
  const branchIdx = hour === 23 ? 0 : Math.floor((hour + 1) / 2);
  const dayStemIdx = dayCycleIdx % 10;
  const startStemIdx = ((dayStemIdx % 5) * 2) % 10;
  const hourStemIdx  = (startStemIdx + branchIdx) % 10;
  const cycleIdx = findCyclePos(hourStemIdx, branchIdx);
  return { cycleIdx, chars: cycleToChars(cycleIdx) };
}

function dateToEightChars(year, month, day, hour) {
  const yp = getYearPillar(year, month, day);
  const sajuYear = (month < 2 || (month === 2 && day < 4)) ? year - 1 : year;
  const yCycleForMonth = ((sajuYear - 2024 + 40) % 60 + 60) % 60;
  const mp = getMonthPillar(year, month, day, yCycleForMonth);
  const dp = getDayPillar(year, month, day);
  const hp = getHourPillar(dp.cycleIdx, hour);
  return [yp.chars[0], yp.chars[1], mp.chars[0], mp.chars[1], dp.chars[0], dp.chars[1], hp.chars[0], hp.chars[1]];
}

// =====================================================================
// 4. 사주 계산
// =====================================================================
function getSipseong(dayStem, targetChar) {
  const [myElem, myYy] = CHAR_INFO[dayStem];
  const [tElem,  tYy]  = CHAR_INFO[targetChar];
  const mi = ELEM_IDX[myElem], ti = ELEM_IDX[tElem];
  const same = myYy === tYy;

  if (mi === ti)               return same ? '비견' : '겁재';
  if ((mi+1)%5 === ti)         return same ? '식신' : '상관';
  if ((mi+2)%5 === ti)         return same ? '편재' : '정재';
  if ((ti+2)%5 === mi)         return same ? '편관' : '정관';
  if ((ti+1)%5 === mi)         return same ? '편인' : '정인';

  throw new Error(`십성 계산 실패: ${dayStem}, ${targetChar}`);
}

function getTwelveStage(dayStem, ji) {
  const start   = JANGSEONG_START[dayStem];
  const jiIdx   = JIJI.indexOf(ji);
  const stageIdx = IS_YANG_GAN[dayStem]
    ? ((jiIdx - start) % 12 + 12) % 12
    : ((start - jiIdx) % 12 + 12) % 12;
  return TWELVE_STAGES[stageIdx];
}

function countOheng(eightChars) {
  const oheng = {'목':0,'화':0,'토':0,'금':0,'수':0};
  for (const ch of eightChars) oheng[CHAR_INFO[ch][0]]++;
  return oheng;
}

function ohengStatus(c) {
  if (c === 0) return '매우 약함';
  if (c === 1) return '약한 편';
  if (c === 2) return '보통';
  return '강한 편';
}

function computeCheonganRelations(gans) {
  const rels = [];
  const gp = GAN_POSITIONS.map((p,i) => [p, gans[i]]);

  for (let i=0; i<gp.length; i++) for (let j=i+1; j<gp.length; j++) {
    const [p1,g1] = gp[i], [p2,g2] = gp[j];

    for (const [a,b,elem] of CHEONGAN_HAP) {
      if (new Set([g1,g2]).size===2 && [a,b].every(x=>[g1,g2].includes(x))) {
        rels.push({type:'천간합', pair:[`${p1}:${g1}`,`${p2}:${g2}`], element:elem});
      }
    }
    for (const [a,b] of CHEONGAN_CHUNG) {
      if ([a,b].every(x=>[g1,g2].includes(x)) && new Set([g1,g2]).size===2) {
        rels.push({type:'천간충', pair:[`${p1}:${g1}`,`${p2}:${g2}`]});
      }
    }
  }

  return dedupeList(rels, ['type','pair','element']);
}

function computeJijiRelations(jis) {
  const rels = [];
  const jp = JI_POSITIONS.map((p,i) => [p, jis[i]]);

  for (let i=0; i<jp.length; i++) for (let j=i+1; j<jp.length; j++) {
    const [p1,j1] = jp[i], [p2,j2] = jp[j];

    for (const [a,b,elem] of YUKAP) {
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2) {
        rels.push({type:'육합', pair:[`${p1}:${j1}`,`${p2}:${j2}`], element:elem});
      }
    }
    for (const [a,b] of CHUNG) {
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2) {
        rels.push({type:'충', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
      }
    }
    for (const [a,b] of PA) {
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2) {
        rels.push({type:'파', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
      }
    }
    for (const [a,b] of HAE) {
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2) {
        rels.push({type:'해', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
      }
    }
    if (j1===j2 && JAHYUNG.has(j1)) {
      rels.push({type:'자형', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
    }
  }

  for (const [members, elem] of SAMHAP) {
    if (members.every(m => jis.includes(m))) {
      rels.push({
        type:'삼합',
        members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`),
        element:elem
      });
    } else {
      const present = members.filter(m => jis.includes(m));
      if (present.length===2 && present.includes(members[1])) {
        rels.push({
          type:'반합',
          members:jp.filter(([,j])=>present.includes(j)).map(([p,j])=>`${p}:${j}`),
          element:elem
        });
      }
    }
  }

  for (const [members, elem] of BANGHAP) {
    if (members.every(m => jis.includes(m))) {
      rels.push({
        type:'방합',
        members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`),
        element:elem
      });
    }
  }

  for (const members of HYUNG3) {
    if (members.every(m => jis.includes(m))) {
      rels.push({type:'삼형', members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`)});
    } else {
      const present = members.filter(m => jis.includes(m));
      if (present.length===2) {
        rels.push({type:'반형', members:jp.filter(([,j])=>present.includes(j)).map(([p,j])=>`${p}:${j}`)});
      }
    }
  }

  for (const members of HYUNG2) {
    if (members.every(m => jis.includes(m))) {
      rels.push({type:'이형', members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`)});
    }
  }

  return dedupeList(rels, ['type','pair','members','element']);
}

function computeSinsal(dayGan, yearJi, dayJi, jis) {
  const jp = JI_POSITIONS.map((p,i) => [p, jis[i]]);
  let sinsal = [];

  for (const [basisName, basisJi] of [['년지',yearJi],['일지',dayJi]]) {
    const grp = SAMHAP_GROUP[basisJi] || '';
    if (SINSAL_TABLE[grp]) {
      for (const [sname, sji] of Object.entries(SINSAL_TABLE[grp])) {
        for (const [pos, ji] of jp) {
          if (ji === sji) sinsal.push({name:sname, position:`${pos}:${ji}`, basis:basisName});
        }
      }
    }
  }

  sinsal = dedupeList(sinsal, ['name','position','basis']);

  let gwiin = [];
  for (const tji of (CHEONUL[dayGan] || [])) {
    for (const [pos, ji] of jp) {
      if (ji === tji) gwiin.push({name:'천을귀인', position:`${pos}:${ji}`});
    }
  }

  const mc = MUNCHANG[dayGan], hd = HAKDANG[dayGan], gy = GEUMYEO[dayGan];
  for (const [pos, ji] of jp) {
    if (ji === mc) gwiin.push({name:'문창귀인', position:`${pos}:${ji}`});
    if (ji === hd) gwiin.push({name:'학당귀인', position:`${pos}:${ji}`});
    if (ji === gy) gwiin.push({name:'금여록',   position:`${pos}:${ji}`});
  }

  gwiin = dedupeList(gwiin, ['name','position']);
  return { sinsal, gwiin };
}

function computeSaju(eightChars) {
  const [yearGan,yearJi,monthGan,monthJi,dayGan,dayJi,hourGan,hourJi] = eightChars;
  const gans = [yearGan,monthGan,dayGan,hourGan];
  const jis  = [yearJi,monthJi,dayJi,hourJi];
  const [myElem, myYy] = CHAR_INFO[dayGan];

  const oheng = countOheng(eightChars);
  const ohengAnalysis = Object.fromEntries(
    Object.entries(oheng).map(([e,c])=>[e,ohengStatus(c)])
  );

  const cheonganSipseong = {};
  GAN_POSITIONS.forEach((pos,i) => {
    cheonganSipseong[pos] = pos==='일간' ? '일간(나)' : getSipseong(dayGan, gans[i]);
  });

  const jijiMainSipseong = {}, jijangganSipseong = {};
  const hiddenTengods = [];

  JI_POSITIONS.forEach((pos,i) => {
    const ji = jis[i];
    const hidden = JIJANGGAN[ji];
    const fullTg = hidden.map(g => [g, getSipseong(dayGan, g)]);
    jijiMainSipseong[pos] = getSipseong(dayGan, hidden[0]);
    jijangganSipseong[pos] = { 지지:ji, 장간:fullTg };
    fullTg.forEach(([,tg]) => hiddenTengods.push(tg));
  });

  const ganTengods = GAN_POSITIONS.filter(p=>p!=='일간').map(p=>cheonganSipseong[p]);
  const total = [...ganTengods, ...hiddenTengods];
  const sipseongCounts = counter(total);
  const coreSipseong   = mostCommon(sipseongCounts, 3);
  const twelveStages   = Object.fromEntries(JI_POSITIONS.map((p,i)=>[p, getTwelveStage(dayGan,jis[i])]));
  const cheonganRels   = computeCheonganRelations(gans);
  const jijiRels       = computeJijiRelations(jis);
  const {sinsal, gwiin}= computeSinsal(dayGan, yearJi, dayJi, jis);

  return {
    '사주_원국': {'년주':`${yearGan}${yearJi}`,'월주':`${monthGan}${monthJi}`,'일주':`${dayGan}${dayJi}`,'시주':`${hourGan}${hourJi}`},
    '일간': dayGan,
    '일간_오행': {element_ko:myElem, element_hanja:ELEM_HANJA[myElem], yin_yang:myYy?'양':'음'},
    '오행_기본분포': oheng,
    '오행_분석': ohengAnalysis,
    '천간_십성': cheonganSipseong,
    '지지_주기십성': jijiMainSipseong,
    '지장간_십성': jijangganSipseong,
    '십성_요약': sipseongCounts,
    '핵심_십성': coreSipseong,
    '십이운성': twelveStages,
    '천간_관계': cheonganRels,
    '지지_관계': jijiRels,
    '십이신살': sinsal,
    '귀인_신살': gwiin,
  };
}

// =====================================================================
// 5. 구조 해석 feature
// =====================================================================
function dayMasterStrength(computed) {
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

  // 득령
  if (monthBoost === dayElem) score += 2.4;
  if ((ELEM_IDX[monthBoost] + 1) % 5 === ELEM_IDX[dayElem]) score += 1.0;

  // 비겁/인성
  score += tg('비견') * 1.2;
  score += tg('겁재') * 0.9;
  score += tg('정인') * 1.0;
  score += tg('편인') * 0.8;

  // 식상/재성/관성
  score -= tg('식신') * 0.45;
  score -= tg('상관') * 0.55;
  score -= tg('정재') * 0.45;
  score -= tg('편재') * 0.45;
  score -= tg('정관') * 0.55;
  score -= tg('편관') * 0.65;

  // 같은 오행, 생조 오행
  score += elem(dayElem) * 0.35;

  // 통근
  for (const pos of Object.keys(hidden)) {
    const stems = hidden[pos].장간.map(([gan]) => gan);
    if (stems.includes(dayGan)) score += 0.8;
  }

  let label = '중화';
  if (score >= 4.1) label = '신강';
  else if (score <= 1.2) label = '신약';

  return { score: round2(score), label };
}

function relationFeatures(computed) {
  const stemRels = computed['천간_관계'];
  const branchRels = computed['지지_관계'];
  const all = [...stemRels, ...branchRels];

  const chong = all.filter(r => String(r.type).includes('충'));
  const hap = all.filter(r => String(r.type).includes('합'));
  const hyung = branchRels.filter(r => String(r.type).includes('형'));
  const pa = branchRels.filter(r => String(r.type).includes('파'));
  const hae = branchRels.filter(r => String(r.type).includes('해'));

  const conflictLevel = chong.length * 1.4 + hyung.length * 1.0 + pa.length * 0.8 + hae.length * 0.5;
  const stabilityLevel = hap.length * 1.0;

  const conflictDescriptions = [];
  for (const r of chong) {
    const raw = r.pair?.map(x => x.split(':')[1]).sort().join('') || '';
    if (CONFLICT_MEANING[raw]) conflictDescriptions.push(CONFLICT_MEANING[raw]);
  }

  return {
    chongCount: chong.length,
    hapCount: hap.length,
    hyungCount: hyung.length,
    paCount: pa.length,
    haeCount: hae.length,
    conflictLevel: round2(conflictLevel),
    stabilityLevel: round2(stabilityLevel),
    conflictDescriptions: [...new Set(conflictDescriptions)].slice(0, 2),
  };
}

function calculateStructuralFeatures(computed) {
  const ten = computed['십성_요약'];
  const oh = computed['오행_기본분포'];
  const dmStrength = dayMasterStrength(computed);
  const rel = relationFeatures(computed);

  const tg = n => ten[n] || 0;
  const elem = n => oh[n] || 0;

  const selfDrive = tg('비견') * 1.35 + tg('겁재') * 1.1 + (dmStrength.label === '신강' ? 0.8 : 0);
  const expressionDrive = tg('식신') * 1.0 + tg('상관') * 1.15 + elem('화') * 0.45 + elem('수') * 0.35;
  const supportDrive = tg('정인') * 1.3 + tg('편인') * 1.0 + elem('금') * 0.45;
  const controlDrive = tg('정관') * 1.45 + tg('편관') * 1.2 + elem('토') * 0.55 + elem('금') * 0.35;

  const realityFocus = elem('토') * 1.0 + elem('금') * 0.8 + tg('정관') * 0.55;
  const abstractionFocus = elem('수') * 1.0 + elem('목') * 0.7 + tg('편인') * 0.45 + tg('상관') * 0.35;

  const relationalSensitivity = elem('수') * 1.0 + elem('목') * 0.55 + tg('식신') * 0.35 + tg('정인') * 0.45;
  const emotionalContainment = tg('정관') * 0.8 + tg('편관') * 0.7 + tg('정인') * 0.55 + rel.conflictLevel * 0.35;
  const flexibility = elem('수') * 0.7 + tg('식신') * 0.55 + tg('상관') * 0.75 + rel.chongCount * 0.7;
  const structureNeed = tg('정관') * 1.0 + tg('정인') * 0.7 + elem('토') * 0.55 + elem('금') * 0.3;
  const internalConflict = rel.conflictLevel * 1.0 + emotionalContainment * 0.25;

  const dominantPatterns = [];
  if (tg('정관') + tg('편관') >= 3) dominantPatterns.push('관성 강세');
  if (tg('정인') + tg('편인') >= 3) dominantPatterns.push('인성 강세');
  if (tg('비견') + tg('겁재') >= 3) dominantPatterns.push('비견/겁재 강세');
  if (tg('식신') + tg('상관') <= 1) dominantPatterns.push('식상 약세');
  if (rel.chongCount >= 1) dominantPatterns.push('충 구조');
  if (dmStrength.label === '신강') dominantPatterns.push('일간 주도성 강함');
  if (dmStrength.label === '신약') dominantPatterns.push('환경 영향 민감');

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
    conflictDescriptions: rel.conflictDescriptions,
    dominantPatterns,
  };
}

// =====================================================================
// 6. MBTI 축 계산
// =====================================================================
function labelByGap(gap) {
  if (gap < 0.45) return 'balanced';
  if (gap < 1.1) return 'close';
  if (gap < 2.0) return 'lean';
  return 'clear';
}

function axisReasonPack(axisKey, winner, features, computed) {
  const dm = computed['일간'];
  const reasons = {
    'E/I': {
      E: [
        '자기주도성과 바깥으로 반응하는 힘이 비교적 큰 편입니다.',
        '혼자만 축적하기보다 상호작용 속에서 에너지가 움직일 가능성이 큽니다.',
      ],
      I: [
        '반응보다 관찰과 내부 정리를 먼저 거치는 경향이 더 강하게 보입니다.',
        '말이나 행동보다 생각과 축적이 먼저 작동하는 구조에 가깝습니다.',
      ]
    },
    'N/S': {
      N: [
        '정보를 그대로 받기보다 의미와 흐름으로 재해석하려는 성향이 있습니다.',
        `${DAY_MASTER_LABEL[dm]}의 성향과 수/인성 계열이 겹치면 심리나 맥락을 더 읽으려는 쪽으로 기웁니다.`,
      ],
      S: [
        '추상적 가능성보다 실제 상황과 구체 조건을 먼저 보는 편입니다.',
        '상상력 자체보다 현실 판단과 관찰력이 더 앞에 나오는 구조입니다.',
      ]
    },
    'T/F': {
      T: [
        '판단할 때 감정보다 기준과 정리, 맞고 틀림을 먼저 보려는 경향이 있습니다.',
        '다만 완전히 차갑다기보다 관계를 고려하면서도 결론은 정리 쪽으로 가는 편입니다.',
      ],
      F: [
        '사람의 반응과 감정선이 판단에 꽤 영향을 미치는 구조입니다.',
        '겉으로는 정리해 보여도 실제론 관계의 온도를 많이 읽는 편일 수 있습니다.',
      ]
    },
    'J/P': {
      J: [
        '미리 정리하고 예측 가능한 틀 안에서 움직일 때 더 편할 가능성이 큽니다.',
        '유연 대응을 하더라도 내부 기준이나 정리 욕구는 강하게 살아 있는 편입니다.',
      ],
      P: [
        '고정된 계획보다 상황 변화에 따라 수정하며 움직이는 쪽이 더 편할 수 있습니다.',
        '통제 욕구가 아주 약한 건 아니지만, 현장 반응이 계획보다 앞설 수 있습니다.',
      ]
    }
  };

  return reasons[axisKey][winner];
}

function buildAxisResult(axisKey, a, b, aScore, bScore, features, computed) {
  const winner = aScore >= bScore ? a : b;
  const loser = winner === a ? b : a;
  const gap = Math.abs(aScore - bScore);
  const label = labelByGap(gap);

  return {
    result: winner,
    loser,
    label,
    scores: { [a]: round2(aScore), [b]: round2(bScore) },
    reasons: axisReasonPack(axisKey, winner, features, computed),
  };
}

function calculateMbti(features, computed) {
  const ten = computed['십성_요약'];
  const tg = n => ten[n] || 0;
  const isWaterDayMaster = ['壬','癸'].includes(computed['일간']);

  // E/I
  let eScore =
    features.selfDrive * 0.45 +
    features.expressionDrive * 0.35 +
    features.flexibility * 0.15;

  let iScore =
    features.supportDrive * 0.45 +
    features.emotionalContainment * 0.35 +
    features.internalConflict * 0.25;

  if ((tg('식신') + tg('상관')) <= 1) iScore += 0.6;
  if ((tg('정관') + tg('편관')) >= 3) iScore += 0.5;
  if (isWaterDayMaster) iScore += 0.35;
  if (features.dayMasterStrengthLabel === '신약') iScore += 0.3;

  // N/S
  let nScore =
    features.abstractionFocus * 0.5 +
    features.internalConflict * 0.2 +
    features.relationalSensitivity * 0.2;

  let sScore =
    features.realityFocus * 0.5 +
    features.structureNeed * 0.2 +
    features.controlDrive * 0.15;

  if (isWaterDayMaster) nScore += 0.35;
  if ((tg('정관') + tg('편관')) >= 3 && (tg('식신') + tg('상관')) <= 1) sScore += 0.45;

  // T/F
  let tScore =
    features.controlDrive * 0.45 +
    features.realityFocus * 0.25 +
    features.structureNeed * 0.2;

  let fScore =
    features.relationalSensitivity * 0.4 +
    features.supportDrive * 0.25 +
    features.internalConflict * 0.15;

  if (isWaterDayMaster) fScore += 0.25;
  if ((tg('정관') + tg('편관')) >= 3) tScore += 0.25;

  // J/P
  let jScore =
    features.structureNeed * 0.45 +
    features.controlDrive * 0.25 +
    features.emotionalContainment * 0.2;

  let pScore =
    features.flexibility * 0.4 +
    features.expressionDrive * 0.2 +
    features.conflictLevel * 0.15;

  if ((tg('정관') + tg('편관')) >= 3) jScore += 0.55;
  if ((tg('식신') + tg('상관')) <= 1) jScore += 0.3;
  if (features.conflictLevel >= 2 && (tg('정관') + tg('편관')) >= 3) {
    // 충이 있어도 관성이 강하면 "불안정한 J" 쪽으로 본다
    jScore += 0.45;
    pScore -= 0.15;
  }

  const axes = {
    'E/I': buildAxisResult('E/I', 'E', 'I', eScore, iScore, features, computed),
    'N/S': buildAxisResult('N/S', 'N', 'S', nScore, sScore, features, computed),
    'T/F': buildAxisResult('T/F', 'T', 'F', tScore, fScore, features, computed),
    'J/P': buildAxisResult('J/P', 'J', 'P', jScore, pScore, features, computed),
  };

  const type = `${axes['E/I'].result}${axes['N/S'].result}${axes['T/F'].result}${axes['J/P'].result}`;

  // 2순위 후보: 가장 박빙인 축 뒤집기
  const closeness = Object.entries(axes)
    .map(([axis, info]) => ({
      axis,
      gap: Math.abs(Object.values(info.scores)[0] - Object.values(info.scores)[1])
    }))
    .sort((a,b) => a.gap - b.gap);

  const chars = type.split('');
  const idxMap = { 'E/I':0, 'N/S':1, 'T/F':2, 'J/P':3 };
  const closestAxis = closeness[0]?.axis;

  if (closestAxis) {
    const pos = idxMap[closestAxis];
    const current = chars[pos];
    const [a,b] = closestAxis.split('/');
    chars[pos] = current === a ? b : a;
  }

  const secondary = chars.join('');

  const scores = {
    E: round2(eScore), I: round2(iScore),
    N: round2(nScore), S: round2(sScore),
    T: round2(tScore), F: round2(fScore),
    J: round2(jScore), P: round2(pScore),
  };

  return { type, secondary, scores, axes };
}

// =====================================================================
// 7. 설명 생성
// =====================================================================
function axisDisplayText(axisInfo, axisKey) {
  const names = {
    'E':'외향형','I':'내향형','N':'직관형','S':'감각형',
    'T':'사고형','F':'감정형','J':'판단형','P':'인식형'
  };
  const labelText = {
    balanced: '거의 비슷',
    close: '근소 우세',
    lean: '우세',
    clear: '뚜렷'
  };

  const winner = axisInfo.result;
  const loser = axisInfo.loser;
  return `${winner} ${names[winner]} (${labelText[axisInfo.label]})${axisInfo.label === 'balanced' ? ` / ${loser}와 차이가 크지 않음` : ''}`;
}

function buildSummary(computed, features, mbti) {
  const dm = DAY_MASTER_LABEL[computed['일간']];
  const core = features.dominantPatterns.slice(0, 3).join(', ');
  const conflictComment = features.conflictDescriptions[0]
    ? ` 또한 ${features.conflictDescriptions[0]}`
    : '';

  return `${dm} 구조를 기준으로 보면 ${mbti.type} 쪽이 가장 유력합니다. 이 결과는 ${core || '복합적인 구조'}를 바탕으로 나온 것으로, 겉으로 드러나는 태도와 내부 정서가 완전히 같지 않을 수 있습니다.${conflictComment}`;
}

function buildPersonality(computed, features, mbti) {
  const dm = DAY_MASTER_LABEL[computed['일간']];
  const dmTone = DAY_MASTER_TONE[computed['일간']];
  const strength = features.dayMasterStrengthLabel;

  let sentence = `${dm} 특유의 결은 ${dmTone}에 가깝습니다. `;
  if (strength === '신강') {
    sentence += '기본적으로 자기 방식과 기준을 지키려는 힘이 비교적 강합니다. ';
  } else if (strength === '신약') {
    sentence += '기본적으로 환경과 사람의 흐름에 민감하게 반응하는 편입니다. ';
  } else {
    sentence += '한쪽으로 과하게 치우치기보다 상황에 따라 결이 달라질 여지가 있습니다. ';
  }

  if (features.controlDrive >= 3.5) {
    sentence += '관성 쪽 힘이 있어 책임감, 규칙 의식, 현실 감각이 함께 작동합니다. ';
  }
  if (features.expressionDrive <= 1.2) {
    sentence += '식상 쪽 발산력이 약한 편이라 하고 싶은 말을 바로 꺼내기보다 내부에서 먼저 정리하는 쪽에 가깝습니다. ';
  }
  if (features.internalConflict >= 2.2) {
    sentence += '내부 갈등이 존재해 겉으로는 차분해 보여도 속으로 생각이 많을 수 있습니다. ';
  }

  return sentence.trim();
}

function buildRelationship(features, mbti) {
  const type = mbti.type;

  let base = '';
  if (type[0] === 'I') {
    base += '관계에서 먼저 크게 드러나기보다, 관찰과 거리 조절을 거친 뒤 깊어지는 편입니다. ';
  } else {
    base += '관계에서 반응 속도는 빠를 수 있지만, 누구에게나 같은 온도로 열리는 타입은 아닐 수 있습니다. ';
  }

  if (type[2] === 'T') {
    base += '상대를 생각하지 않는다는 뜻이 아니라, 최종 판단에서는 정리와 기준을 더 우선하는 경향이 있습니다. ';
  } else {
    base += '상대 감정과 관계 분위기가 판단에 실제로 영향을 줄 가능성이 큽니다. ';
  }

  if (features.internalConflict >= 2.2) {
    base += '상처나 스트레스를 겉보다 안쪽에 오래 두는 구조라, 표현보다 축적이 먼저 일어날 수 있습니다.';
  } else if (features.expressionDrive <= 1.2) {
    base += '감정이 없어서가 아니라 표현이 늦을 수 있어, 가까운 사람은 답답함을 느낄 수도 있습니다.';
  } else {
    base += '가까워질수록 표현이 자연스러워지지만, 기본적인 기준은 쉽게 바뀌지 않는 편입니다.';
  }

  return base.trim();
}

function buildCaution(features, mbti) {
  let text = '';

  if (features.controlDrive >= 3.5 && features.internalConflict >= 2.2) {
    text += '책임감과 내부 압박이 같이 강하면 겉으로는 버티는데 속으로 피로가 쌓일 수 있습니다. ';
  }
  if (mbti.axes['J/P'].label === 'balanced' || mbti.axes['J/P'].label === 'close') {
    text += '정리를 원하면서도 유연 대응도 필요해, 계획이 깨질 때 스트레스를 크게 받을 가능성이 있습니다. ';
  }
  if (features.expressionDrive <= 1.2) {
    text += '표현이 늦으면 오해가 쌓일 수 있으니, 중요한 감정이나 불편함은 조금 더 빨리 언어화하는 연습이 필요합니다.';
  }

  if (!text) {
    text = '강점이 분명한 구조지만, 기준과 감정 사이의 균형이 무너질 때 피로가 커질 수 있습니다.';
  }

  return text.trim();
}

function buildRelationshipCards(mbti, features) {
  const compatMap = {
    'INTJ':'ENFP','INTP':'ENTJ','INFJ':'ENTP','INFP':'ENFJ',
    'ISTJ':'ESFP','ISTP':'ESFJ','ISFJ':'ESTP','ISFP':'ESTJ',
    'ENTJ':'INTP','ENTP':'INFJ','ENFJ':'INFP','ENFP':'INTJ',
    'ESTJ':'ISFP','ESTP':'ISFJ','ESFJ':'ISTP','ESFP':'ISTJ'
  };

  let love = '';
  if (mbti.type.startsWith('I')) {
    love = '연애에서는 속도가 빠르기보다 신뢰가 쌓여야 깊게 들어가는 편일 가능성이 큽니다. 감정을 쉽게 드러내지 않아도 애정이 없는 타입은 아닙니다.';
  } else {
    love = '연애에서 반응은 비교적 빠를 수 있지만, 실제 속내를 다 보여주기까지는 별도 시간이 필요할 수 있습니다.';
  }

  let relationship = '';
  if (features.controlDrive >= 3.5) {
    relationship = '사람 관계에서도 기준과 책임감이 함께 작동합니다. 편한 사람과 아닌 사람의 경계가 분명할 수 있습니다.';
  } else if (features.relationalSensitivity >= 2.8) {
    relationship = '사람의 반응과 관계 흐름을 예민하게 읽는 편이라 분위기 변화에 민감할 수 있습니다.';
  } else {
    relationship = '관계에서 감정과 현실 판단이 동시에 작동하는 편이라, 상황마다 보이는 결이 달라질 수 있습니다.';
  }

  const compat = compatMap[mbti.type] || mbti.secondary;

  return {
    love,
    relationship,
    compatible_mbti: compat,
    compat_desc: '너무 닮은 사람보다, 부족한 축을 보완해주면서도 기본 리듬이 크게 어긋나지 않는 타입이 더 잘 맞을 수 있습니다.',
  };
}

// =====================================================================
// 8. 응답 조립
// =====================================================================
function buildResponseData(computed) {
  const features = calculateStructuralFeatures(computed);
  const mbti = calculateMbti(features, computed);

  return {
    features,
    mbti: {
      type: mbti.type,
      secondary: mbti.secondary,
      scores: mbti.scores,
      confidence: Object.fromEntries(
        Object.entries(mbti.axes).map(([k,v]) => [
          k,
          {
            result: v.result,
            loser: v.loser,
            label: v.label,
            display: axisDisplayText(v, k),
            reasons: v.reasons,
          }
        ])
      )
    },
    interpretation_blocks: {
      summary: buildSummary(computed, features, mbti),
      personality: buildPersonality(computed, features, mbti),
      relationship: buildRelationship(features, mbti),
      caution: buildCaution(features, mbti),
      reason_summary: `1순위 ${mbti.type}, 2순위 ${mbti.secondary}, 일간 강도 ${features.dayMasterStrengthLabel}, 핵심 패턴 ${features.dominantPatterns.slice(0,3).join(', ')}`,
    },
    relationship_cards: buildRelationshipCards(mbti, features),
  };
}

// =====================================================================
// 9. 핸들러
// =====================================================================
export async function onRequestPost(context) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error:'요청 본문이 올바르지 않습니다.' }), { status:400, headers:corsHeaders });
  }

  const { year, month, day, hour } = body;

  if (!year || !month || !day || hour === undefined) {
    return new Response(JSON.stringify({ error:'year, month, day, hour는 필수입니다.' }), { status:400, headers:corsHeaders });
  }

  try {
    const eightChars = dateToEightChars(year, month, day, hour);
    const computed = computeSaju(eightChars);
    const built = buildResponseData(computed);

    return new Response(JSON.stringify({
      success: true,
      eight_chars: eightChars,
      pillars: computed['사주_원국'],
      day_master: computed['일간'],
      day_master_label: DAY_MASTER_LABEL[computed['일간']],
      five_elements: computed['오행_기본분포'],
      five_elements_status: computed['오행_분석'],
      saju_structure: built.features,
      ten_gods_summary: computed['십성_요약'],
      core_ten_gods: computed['핵심_십성'],
      stem_relations: computed['천간_관계'],
      branch_relations: computed['지지_관계'],
      mbti: built.mbti,
      interpretation_blocks: built.interpretation_blocks,
      relationship_cards: built.relationship_cards,
    }), { status:200, headers:corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status:500, headers:corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status:204,
    headers:{
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
    }
  });
}