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
  const startStemIdx  = ((dayStemIdx % 5) * 2) % 10;
  const hourStemIdx   = (startStemIdx + branchIdx) % 10;
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
  const sipseongCounts   = counter(total);
  const coreSipseong     = mostCommon(sipseongCounts, 3);
  const twelveStages     = Object.fromEntries(JI_POSITIONS.map((p,i)=>[p, getTwelveStage(dayGan,jis[i])]));
  const cheonganRels     = computeCheonganRelations(gans);
  const jijiRels         = computeJijiRelations(jis);
  const {sinsal, gwiin}  = computeSinsal(dayGan, yearJi, dayJi, jis);

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

  if (monthBoost === dayElem) score += 2.4;
  if ((ELEM_IDX[monthBoost] + 1) % 5 === ELEM_IDX[dayElem]) score += 1.0;

  score += tg('비견') * 1.2;
  score += tg('겁재') * 0.9;
  score += tg('정인') * 1.0;
  score += tg('편인') * 0.8;

  score -= tg('식신') * 0.45;
  score -= tg('상관') * 0.55;
  score -= tg('정재') * 0.45;
  score -= tg('편재') * 0.45;
  score -= tg('정관') * 0.55;
  score -= tg('편관') * 0.65;

  score += elem(dayElem) * 0.35;

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

function buildStructureLabels(computed, features) {
  const ten = computed['십성_요약'];
  const tg = n => ten[n] || 0;
  const labels = [];

  if ((tg('정관') + tg('편관')) >= 3) labels.push('관성 강세형');
  if ((tg('정인') + tg('편인')) >= 3) labels.push('인성 강세형');
  if ((tg('비견') + tg('겁재')) >= 3) labels.push('비견 강세형');
  if ((tg('식신') + tg('상관')) <= 1) labels.push('식상 약세형');
  if ((tg('식신') + tg('상관')) >= 3) labels.push('식상 발산형');
  if (features.conflictLevel >= 2.0) labels.push('충돌 내면형');
  if (features.structureNeed >= 2.6) labels.push('책임 구조형');
  if (features.relationalSensitivity >= 2.5) labels.push('관계 민감형');
  if (features.abstractionFocus >= 2.3) labels.push('해석 중심형');
  if (features.dayMasterStrengthLabel === '신약') labels.push('환경 민감형');
  if (features.supportDrive >= 2.5 && features.expressionDrive <= 1.3) labels.push('내면 축적형');

  return labels.slice(0, 5);
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
        '겉으로 바로 움직이기보다 관찰과 내부 정리를 먼저 거치는 쪽에 가깝습니다.',
        '표현이 적어서가 아니라, 생각과 감정이 안에서 오래 가공된 뒤 밖으로 나오는 구조입니다.',
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
        '관계를 무시한다기보다 최종 결론은 정리와 기준 쪽으로 가는 편입니다.',
      ],
      F: [
        '판단에서 감정에 휘둘린다기보다, 사람 사이의 온도와 맥락을 실제로 중요하게 반영하는 구조입니다.',
        '겉으로는 이성적으로 보여도 속에서는 관계 반응과 감정선이 꽤 크게 작동할 수 있습니다.',
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
  const oh  = computed['오행_기본분포'];
  const dm  = computed['일간'];
  const tg  = n => ten[n] || 0;
  const el  = n => oh[n] || 0;

  // ─── 십성 묶음 ───
  // 식신: 따뜻한 관찰/표현 (S+F 약), 상관: 재해석/표현 (N+F 약)
  // 편재: 사물·수치 인지 (S+T), 정재: 현실 운영 (S+T)
  // 정관: 책임·구조 (S+J), 편관: 압박·결단 (T+J)
  // 정인: 수용·공감 (F+I),  편인: 분석·통찰·거리두기 (N+T+I)  ← 여기가 핵심 분리
  // 비견/겁재: 자기 기준 (E/J 약, T 약)
  const sik = tg('식신'), sang = tg('상관');
  const pyJae = tg('편재'), jJae = tg('정재');
  const pyGwan = tg('편관'), jGwan = tg('정관');
  const pyIn = tg('편인'), jIn = tg('정인');
  const biGyeop = tg('비견') + tg('겁재');

  // ─── 일간 본질 (오행+음양) ───
  const yangMetal = dm === '庚';                  // 직선·결단 → T+S
  const yinMetal  = dm === '辛';                  // 정교·기준 → T+S(약)
  const yangEarth = dm === '戊';                  // 중심·안정 → S+J
  const yinEarth  = dm === '己';                  // 현실·세심 → S(약)
  const yangFire  = dm === '丙';                  // 표현·확산 → E+(N약)
  const yinFire   = dm === '丁';                  // 섬세·집중 → F(약)+I
  const yangWood  = dm === '甲';                  // 추진·직진 → T(약)+J
  const yinWood   = dm === '乙';                  // 유연·관계 → F(약)
  const yangWater = dm === '壬';                  // 흐름·시야 → N(약)
  const yinWater  = dm === '癸';                  // 내면·관찰 → I+(F약,N약)

  const sinYak  = features.dayMasterStrengthLabel === '신약';
  const sinGang = features.dayMasterStrengthLabel === '신강';
  const lowExpression = (sik + sang) <= 1;
  const highSupport   = (jIn + pyIn) >= 2;
  const strongAnalysisIn = pyIn >= 2;             // 편인 강세 = 분석/통찰

  // ============ E / I ============
  // (사용자 요청: E/I 축은 흔들지 말 것 → 기존과 비슷한 톤 유지)
  let eScore =
    features.selfDrive * 0.34 +
    features.expressionDrive * 0.26 +
    features.flexibility * 0.12;

  let iScore =
    features.supportDrive * 0.50 +
    features.emotionalContainment * 0.42 +
    features.internalConflict * 0.30 +
    features.structureNeed * 0.12;

  if (lowExpression) iScore += 0.9;
  if (highSupport)   iScore += 0.30;
  if (sinYak)        iScore += 0.20;
  if (yinWater || yinFire) iScore += 0.25;

  // ============ N / S ============
  // N: 추상·해석·통찰. 핵심 십성 = 편인, 상관(재해석), (보조)정인
  // S: 현실·관찰·구체. 핵심 십성 = 식신, 편재, 정재, 정관, 토/금 오행
  // 충돌·관계민감도는 N/S와 무관 → 제거
  let nScore =
    pyIn  * 0.85 +              // 편인 = N의 1순위 시그널
    sang  * 0.45 +              // 상관 = 재해석/표현
    jIn   * 0.20 +              // 정인 = 약한 N
    sik   * 0.15 +              // 식신은 양면 → N에 살짝
    el('수') * 0.25 +
    el('목') * 0.20;

  let sScore =
    sik   * 0.35 +              // 식신 = 구체 관찰
    pyJae * 0.45 +              // 편재 = 사물 인지
    jJae  * 0.50 +              // 정재 = 현실 운영
    jGwan * 0.40 +              // 정관 = 현실 책임
    el('토') * 0.50 +
    el('금') * 0.45 +
    el('화') * 0.10;

  // 일간 본질 보너스
  if (yangMetal) sScore += 0.55;
  if (yinMetal)  sScore += 0.40;
  if (yangEarth) sScore += 0.55;
  if (yinEarth)  sScore += 0.30;
  if (yangFire)  nScore += 0.30;
  if (yangWater) nScore += 0.25;
  if (yinWater)  nScore += 0.15;

  // 신약하면서 편인이 강하면 자기 안에서 의미를 찾는 구조 → N 강한 보너스
  if (sinYak && strongAnalysisIn) nScore += 1.0;
  // 신강하면서 편인이 강하면 자기 기준 안에서 사색하는 구조 → N 보너스
  if (sinGang && strongAnalysisIn) nScore += 0.55;
  // 편인 강세인데 정관이 없으면 외부 책임에 묶이지 않은 자유로운 사고 → N 보너스
  if (strongAnalysisIn && jGwan === 0) nScore += 0.50;
  // 신강하면서 정관·식신이 같이 있으면 현실 책임형 → S 보너스
  if (sinGang && jGwan >= 1 && sik >= 1) sScore += 0.3;

  // ============ T / F ============
  // T: 분석·거리두기·기준. 편인(분석), 편재(수치), 편관(압박), 일간 본질
  //    정관은 J 시그널이지 T 시그널이 아니므로 제외.
  //    비견/겁재는 자기 기준 = J 시그널이지 사고형 시그널이 아니므로 제외.
  // F: 공감·관계 온도. 정인(수용), 식신(따뜻한 표현), 상관(감정 표현)
  let tScore =
    pyIn   * 0.55 +             // 편인 = 분석/거리두기
    pyJae  * 0.40 +             // 편재 = 객관화
    jJae   * 0.30 +
    pyGwan * 0.45 +             // 편관 = 압박/결단
    el('금') * 0.30 +
    el('토') * 0.15;

  let fScore =
    jIn    * 0.85 +             // 정인 = F의 1순위 시그널
    sik    * 0.35 +             // 식신 = 따뜻한 관찰/표현
    sang   * 0.25 +
    features.relationalSensitivity * 0.18;

  // 일간 본질 보너스
  // 일간이 금이라도 식상이 강하면(≥3) 직선성·기준성이 누그러지므로 보너스 약화
  const metalSoftened = (sik + sang) >= 3;
  if (yangMetal) tScore += metalSoftened ? 0.20 : 0.55;
  if (yinMetal)  tScore += metalSoftened ? 0.15 : 0.40;
  if (yangEarth) tScore += 0.30;
  if (yinEarth)  tScore += 0.15;
  if (yangWood)  tScore += 0.25;
  if (yinFire)   fScore += 0.35;
  if (yinWood)   fScore += 0.30;
  if (yinWater)  fScore += 0.20;

  // 일간이 금이고 수오행이 ≥2 → 식상 발달 = 따뜻한 표현/관찰 → F 보너스
  if ((yangMetal || yinMetal) && el('수') >= 2) fScore += 0.40;

  // ============ J / P ============
  let jScore =
    features.structureNeed * 0.46 +
    features.controlDrive * 0.26 +
    features.emotionalContainment * 0.22 +
    features.stabilityLevel * 0.12 +
    jGwan * 0.20;               // 정관 = 책임/구조의 핵심

  let pScore =
    features.flexibility * 0.30 +
    features.expressionDrive * 0.16 +
    features.conflictLevel * 0.10 +
    sang * 0.15;

  if ((jGwan + pyGwan) >= 3) jScore += 0.35;
  if (lowExpression) jScore += 0.18;
  if (yangEarth || yinEarth) jScore += 0.20;
  if (sinGang && (jGwan + pyGwan) >= 2 && features.conflictLevel >= 2.0) {
    jScore += 0.25;
  }

  const axes = {
    'E/I': buildAxisResult('E/I', 'E', 'I', eScore, iScore, features, computed),
    'N/S': buildAxisResult('N/S', 'N', 'S', nScore, sScore, features, computed),
    'T/F': buildAxisResult('T/F', 'T', 'F', tScore, fScore, features, computed),
    'J/P': buildAxisResult('J/P', 'J', 'P', jScore, pScore, features, computed),
  };

  const type = `${axes['E/I'].result}${axes['N/S'].result}${axes['T/F'].result}${axes['J/P'].result}`;

  const closeness = Object.entries(axes)
    .map(([axis, info]) => ({
      axis,
      gap: Math.abs(Object.values(info.scores)[0] - Object.values(info.scores)[1])
    }))
    .sort((a, b) => a.gap - b.gap);

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

function buildStructureDrivenNarrative(computed, features, mbti) {
  const dayMaster = computed['일간'];
  const dayMasterLabel = DAY_MASTER_LABEL[dayMaster] || dayMaster;
  const labels = buildStructureLabels(computed, features);
  const has = label => labels.includes(label);

  let summary = `${dayMasterLabel} 기반 구조에서는 ${mbti.type} 쪽이 가장 유력합니다. 다만 이 결과의 핵심은 MBTI 글자 자체보다 ${labels.slice(0, 3).join(', ')} 구조에 있습니다.`;
  let personality = '';
  let relationship = '';
  let caution = '';

  if (has('관성 강세형') && has('식상 약세형') && has('내면 축적형')) {
    personality = '책임감과 기준 의식이 강한데 표현은 빠르기보다 내부 정리를 거쳐 나오는 편입니다. 그래서 겉으로는 차분하고 통제된 사람처럼 보이지만, 속에서는 생각과 감정이 오래 머무를 가능성이 큽니다.';
  } else if (has('인성 강세형') && has('해석 중심형')) {
    personality = '정보를 바로 쓰기보다 안에서 해석하고 오래 정리하는 경향이 강합니다. 단순히 조용한 게 아니라, 의미와 심리 흐름을 붙잡고 생각하는 타입에 가깝습니다.';
  } else if (has('비견 강세형') && has('식상 발산형')) {
    personality = '자기주도성과 반응 속도가 빠른 편이며, 생각을 바깥으로 밀어내는 힘도 있는 구조입니다. 다만 기준이 강할수록 말이 단단하거나 직선적으로 들릴 수 있습니다.';
  } else if (has('충돌 내면형') && has('관계 민감형')) {
    personality = '겉에서 보이는 태도보다 안쪽 긴장과 반응이 더 복잡할 수 있습니다. 사람과 상황을 잘 읽지만, 그만큼 감정과 생각이 내부에 오래 남는 편입니다.';
  } else {
    personality = '한쪽으로 단순하게 치우친 성격이라기보다, 기준·감정·관계 반응이 함께 작동하는 복합형 구조에 가깝습니다. 그래서 상황에 따라 보이는 결이 조금씩 달라질 수 있습니다.';
  }

  if (has('관계 민감형') && has('식상 약세형')) {
    relationship = '관계에서 감정이 없어서 표현이 적은 게 아니라, 표현보다 내부 처리와 거리 조절이 먼저 일어나는 편입니다. 가까워질수록 깊어질 수 있지만, 상처도 오래 남길 가능성이 있습니다.';
  } else if (has('비견 강세형') && has('충돌 내면형')) {
    relationship = '사람과의 관계에서 자기 기준이 분명한 편이라 맞을 때는 빠르게 가까워지지만, 틀어질 때는 단호하게 거리를 둘 수 있습니다. 갈등이 생기면 내부 긴장이 말투나 태도로 튀어나올 수도 있습니다.';
  } else if (has('책임 구조형')) {
    relationship = '관계에서도 가볍게 흘려보내기보다 책임감과 신뢰를 중요하게 보는 편입니다. 대신 기대치가 무너질 때 실망이나 거리 두기가 빨라질 수 있습니다.';
  } else {
    relationship = '관계에서는 감정선과 현실 판단이 동시에 작동하는 편입니다. 가까운 사람에게만 드러나는 내면 패턴이 따로 있을 가능성이 큽니다.';
  }

  if (has('식상 약세형') && has('충돌 내면형')) {
    caution = '생각과 감정이 안에 오래 쌓이는데 표현은 늦어 스트레스가 누적될 수 있습니다. 중요한 감정이나 불편함은 너무 늦기 전에 언어화하는 연습이 필요합니다.';
  } else if (has('관성 강세형') && has('책임 구조형')) {
    caution = '책임감이 강한 건 장점이지만, 그 힘이 과해지면 스스로를 압박하는 방식으로 흘러갈 수 있습니다. 모든 상황을 통제하려 하기보다 조절 가능한 부분만 쥐는 편이 낫습니다.';
  } else if (has('비견 강세형') && has('식상 발산형')) {
    caution = '자기 생각을 밀고 나가는 힘이 강한 편이라, 상대가 느끼는 압박이나 말의 온도를 놓칠 수 있습니다. 속도보다 조율을 의식하면 강점이 더 잘 살아납니다.';
  } else {
    caution = '강점이 분명한 구조지만, 그 강점이 과해질 때 약점처럼 보일 수 있습니다. 특히 감정·기준·관계 중 어디에서 과열되는지 스스로 체크하는 게 중요합니다.';
  }

  return {
    summary,
    personality,
    relationship,
    caution,
    reason_summary: `${labels.join(', ')} / 1순위 ${mbti.type}${mbti.secondary ? ` / 2순위 ${mbti.secondary}` : ''}`,
    structure_labels: labels,
  };
}

function buildRelationshipCards(mbti, features, structureLabels = []) {
  const compatMap = {
    'INTJ':'ENFP','INTP':'ENTJ','INFJ':'ENTP','INFP':'ENFJ',
    'ISTJ':'ESFP','ISTP':'ESFJ','ISFJ':'ESTP','ISFP':'ESTJ',
    'ENTJ':'INTP','ENTP':'INFJ','ENFJ':'INFP','ENFP':'INTJ',
    'ESTJ':'ISFP','ESTP':'ISFJ','ESFJ':'ISTP','ESFP':'ISTJ'
  };

  const has = label => structureLabels.includes(label);

  let love = '';
  let relationship = '';
  let compatDesc = '';

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
    love,
    relationship,
    compatible_mbti: compatMap[mbti.type] || mbti.secondary,
    compat_desc: compatDesc,
  };
}

// =====================================================================
// 8. 응답 조립
// =====================================================================
function buildResponseData(computed) {
  const features = calculateStructuralFeatures(computed);
  const mbti = calculateMbti(features, computed);
  const narrative = buildStructureDrivenNarrative(computed, features, mbti);

  return {
    features,
    mbti: {
      type: mbti.type,
      secondary: mbti.secondary,
      scores: mbti.scores,
      confidence: Object.fromEntries(
        Object.entries(mbti.axes).map(([k, v]) => [
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
    interpretation_blocks: narrative,
    relationship_cards: buildRelationshipCards(mbti, features, narrative.structure_labels),
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