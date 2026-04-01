// Cloudflare Pages Function — POST /api/analyze
// test.py 전체 로직 JS 포팅 (sajupy 포함)

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
const ELEM_IDX  = {'목':0,'화':1,'토':2,'금':3,'수':4};
const ELEM_HANJA= {'목':'木','화':'火','토':'土','금':'金','수':'水'};

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

// =====================================================================
// 2. 날짜 → 사주 8자 변환 (sajupy 대체)
// =====================================================================

/** UTC 기준 일수 차이 */
function utcDaysDiff(year, month, day) {
  const target = Date.UTC(year, month - 1, day);
  const ref    = Date.UTC(2000, 0, 1); // 2000-01-01 기준
  return Math.round((target - ref) / 86400000);
}

/** 60간지 인덱스 → [천간, 지지] */
function cycleToChars(idx) {
  idx = ((idx % 60) + 60) % 60;
  return [CHEONGAN[idx % 10], JIJI[idx % 12]];
}

/** 60간지 내에서 (천간idx, 지지idx)로 위치 찾기 */
function findCyclePos(stemIdx, branchIdx) {
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stemIdx && i % 12 === branchIdx) return i;
  }
  return 0;
}

/** 년주 계산 (입춘 기준, 약 2월 4일) */
function getYearPillar(year, month, day) {
  let sajuYear = year;
  if (month < 2 || (month === 2 && day < 4)) sajuYear--;
  // 2024 = 甲辰 = cyclePos 40 검증됨
  const cycleIdx = ((sajuYear - 2024 + 40) % 60 + 60) % 60;
  return { cycleIdx, chars: cycleToChars(cycleIdx) };
}

/** 월주 계산 (절기 기준 근사치) */
function getMonthPillar(year, month, day, yearCycleIdx) {
  // 절기 기준 월 인덱스 (0=寅月 입춘, 11=丑月 소한)
  const monthIdx = getMonthIdx(month, day);

  // 사주 연도 기준 연간 인덱스
  const yearStemIdx = yearCycleIdx % 10;
  // 甲/己=丙寅 시작(2), 乙/庚=戊寅(4), 丙/辛=庚寅(6), 丁/壬=壬寅(8), 戊/癸=甲寅(0)
  const startStemIdx = ((yearStemIdx % 5) * 2 + 2) % 10;
  const monthStemIdx   = (startStemIdx + monthIdx) % 10;
  const monthBranchIdx = (2 + monthIdx) % 12; // 寅(2)부터 시작
  const cycleIdx = findCyclePos(monthStemIdx, monthBranchIdx);
  return { cycleIdx, chars: cycleToChars(cycleIdx) };
}

/** 절기 기준 월 인덱스 반환 (0=寅…11=丑) */
function getMonthIdx(month, day) {
  // [시작월, 시작일] 순서로 寅~丑 (0~11)
  const starts = [[2,4],[3,6],[4,5],[5,6],[6,6],[7,7],[8,7],[9,8],[10,8],[11,7],[12,7],[1,6]];
  // 역순 탐색: 가장 늦게 시작한 절기 찾기
  for (let i = starts.length - 1; i >= 0; i--) {
    const [sm, sd] = starts[i];
    if (i === 11) {
      // 丑月: 1월 6일~2월 3일
      if ((month === 1 && day >= 6) || (month === 12 && day >= 999)) return 11;
    } else {
      if (month > sm || (month === sm && day >= sd)) return i;
    }
  }
  // 1월 1~5일 → 子月(10)
  return 10;
}

/** 일주 계산 */
function getDayPillar(year, month, day) {
  // 검증된 기준: 2000-01-01 = 甲寅(50), 2024-01-01 = 庚申(56) 확인
  const REF_IDX = 50;
  const diff = utcDaysDiff(year, month, day);
  const cycleIdx = ((REF_IDX + diff) % 60 + 60) % 60;
  return { cycleIdx, chars: cycleToChars(cycleIdx) };
}

/** 시주 계산 */
function getHourPillar(dayCycleIdx, hour) {
  // 子時: 23:00~00:59 → branchIdx 0
  const branchIdx = hour === 23 ? 0 : Math.floor((hour + 1) / 2);
  const dayStemIdx = dayCycleIdx % 10;
  // 甲/己=甲(0), 乙/庚=丙(2), 丙/辛=戊(4), 丁/壬=庚(6), 戊/癸=壬(8)
  const startStemIdx = ((dayStemIdx % 5) * 2) % 10;
  const hourStemIdx  = (startStemIdx + branchIdx) % 10;
  const cycleIdx = findCyclePos(hourStemIdx, branchIdx);
  return { cycleIdx, chars: cycleToChars(cycleIdx) };
}

/** 생년월일시 → 사주 8자 */
function dateToEightChars(year, month, day, hour) {
  const yp = getYearPillar(year, month, day);
  // 월주 연간은 입춘 기준 연도 사용
  const sajuYear = (month < 2 || (month === 2 && day < 4)) ? year - 1 : year;
  const yCycleForMonth = ((sajuYear - 2024 + 40) % 60 + 60) % 60;
  const mp = getMonthPillar(year, month, day, yCycleForMonth);
  const dp = getDayPillar(year, month, day);
  const hp = getHourPillar(dp.cycleIdx, hour);
  return [yp.chars[0], yp.chars[1], mp.chars[0], mp.chars[1],
          dp.chars[0], dp.chars[1], hp.chars[0], hp.chars[1]];
}

// =====================================================================
// 3. 사주 계산 (test.py 포팅)
// =====================================================================

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
  return arr.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
}

function mostCommon(obj, n) {
  return Object.fromEntries(
    Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0, n)
  );
}

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
  if (c === 0) return '없음(부족)';
  if (c === 1) return '약함';
  if (c === 2) return '보통';
  return '과다';
}

function computeCheonganRelations(gans) {
  const rels = [];
  const gp = GAN_POSITIONS.map((p,i) => [p, gans[i]]);
  for (let i=0; i<gp.length; i++) for (let j=i+1; j<gp.length; j++) {
    const [p1,g1] = gp[i], [p2,g2] = gp[j];
    for (const [a,b,elem] of CHEONGAN_HAP)
      if (new Set([g1,g2]).size===2 && [a,b].every(x=>[g1,g2].includes(x)))
        rels.push({type:'천간합', pair:[`${p1}:${g1}`,`${p2}:${g2}`], element:elem});
    for (const [a,b] of CHEONGAN_CHUNG)
      if ([a,b].every(x=>[g1,g2].includes(x)) && new Set([g1,g2]).size===2)
        rels.push({type:'천간충', pair:[`${p1}:${g1}`,`${p2}:${g2}`]});
  }
  return dedupeList(rels, ['type','pair','element']);
}

function computeJijiRelations(jis) {
  const rels = [];
  const jp = JI_POSITIONS.map((p,i) => [p, jis[i]]);
  for (let i=0; i<jp.length; i++) for (let j=i+1; j<jp.length; j++) {
    const [p1,j1] = jp[i], [p2,j2] = jp[j];
    for (const [a,b,elem] of YUKAP)
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2)
        rels.push({type:'육합', pair:[`${p1}:${j1}`,`${p2}:${j2}`], element:elem});
    for (const [a,b] of CHUNG)
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2)
        rels.push({type:'충', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
    for (const [a,b] of PA)
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2)
        rels.push({type:'파', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
    for (const [a,b] of HAE)
      if ([a,b].every(x=>[j1,j2].includes(x)) && new Set([j1,j2]).size===2)
        rels.push({type:'해', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
    if (j1===j2 && JAHYUNG.has(j1))
      rels.push({type:'자형', pair:[`${p1}:${j1}`,`${p2}:${j2}`]});
  }
  for (const [members, elem] of SAMHAP) {
    if (members.every(m => jis.includes(m))) {
      rels.push({type:'삼합', members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`), element:elem});
    } else {
      const present = members.filter(m => jis.includes(m));
      if (present.length===2 && present.includes(members[1]))
        rels.push({type:'반합', members:jp.filter(([,j])=>present.includes(j)).map(([p,j])=>`${p}:${j}`), element:elem});
    }
  }
  for (const [members, elem] of BANGHAP)
    if (members.every(m => jis.includes(m)))
      rels.push({type:'방합', members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`), element:elem});
  for (const members of HYUNG3) {
    if (members.every(m => jis.includes(m)))
      rels.push({type:'삼형', members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`)});
    else {
      const present = members.filter(m => jis.includes(m));
      if (present.length===2)
        rels.push({type:'반형', members:jp.filter(([,j])=>present.includes(j)).map(([p,j])=>`${p}:${j}`)});
    }
  }
  for (const members of HYUNG2)
    if (members.every(m => jis.includes(m)))
      rels.push({type:'이형', members:jp.filter(([,j])=>members.includes(j)).map(([p,j])=>`${p}:${j}`)});
  return dedupeList(rels, ['type','pair','members','element']);
}

function computeSinsal(dayGan, yearJi, dayJi, jis) {
  const jp = JI_POSITIONS.map((p,i) => [p, jis[i]]);
  let sinsal = [];
  for (const [basisName, basisJi] of [['년지',yearJi],['일지',dayJi]]) {
    const grp = SAMHAP_GROUP[basisJi] || '';
    if (SINSAL_TABLE[grp]) {
      for (const [sname, sji] of Object.entries(SINSAL_TABLE[grp]))
        for (const [pos, ji] of jp)
          if (ji === sji) sinsal.push({name:sname, position:`${pos}:${ji}`, basis:basisName});
    }
  }
  sinsal = dedupeList(sinsal, ['name','position','basis']);
  let gwiin = [];
  for (const tji of (CHEONUL[dayGan] || []))
    for (const [pos, ji] of jp)
      if (ji === tji) gwiin.push({name:'천을귀인', position:`${pos}:${ji}`});
  const mc = MUNCHANG[dayGan], hd = HAKDANG[dayGan], gy = GEUMYEO[dayGan];
  for (const [pos, ji] of jp) {
    if (ji === mc) gwiin.push({name:'문창귀인', position:`${pos}:${ji}`});
    if (ji === hd) gwiin.push({name:'학당귀인', position:`${pos}:${ji}`});
    if (ji === gy) gwiin.push({name:'금여록',   position:`${pos}:${ji}`});
  }
  gwiin = dedupeList(gwiin, ['name','position']);
  return {sinsal, gwiin};
}

function computeSaju(eightChars) {
  const [yearGan,yearJi,monthGan,monthJi,dayGan,dayJi,hourGan,hourJi] = eightChars;
  const gans = [yearGan,monthGan,dayGan,hourGan];
  const jis  = [yearJi,monthJi,dayJi,hourJi];
  const [myElem, myYy] = CHAR_INFO[dayGan];
  const oheng = countOheng(eightChars);
  const ohengAnalysis = Object.fromEntries(Object.entries(oheng).map(([e,c])=>[e,ohengStatus(c)]));

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
    jijangganSipseong[pos] = {지지:ji, 장간:fullTg};
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

function buildLlmPayload(computed) {
  return {
    pillars: computed['사주_원국'],
    day_master: computed['일간'],
    day_master_info: computed['일간_오행'],
    five_elements_count: computed['오행_기본분포'],
    ten_gods_summary: computed['십성_요약'],
    core_ten_gods: computed['핵심_십성'],
    twelve_states: computed['십이운성'],
    stem_relations: computed['천간_관계'].map(r=>({type:r.type, pair:r.pair||[], element:r.element||null})),
    branch_relations: computed['지지_관계'].map(r=>({type:r.type, pair:r.pair||[], members:r.members||[], element:r.element||null})),
    special_stars: {
      sinsal_names: [...new Set(computed['십이신살'].map(x=>x.name))].sort(),
      gwiin_names:  [...new Set(computed['귀인_신살'].map(x=>x.name))].sort(),
    },
  };
}

// =====================================================================
// 4. MBTI 계산
// =====================================================================
function calculateMbtiScores(oheng, tenGodsSummary, stemRels, branchRels) {
  const tg = n => tenGodsSummary[n] || 0;
  const oh = n => oheng[n] || 0;
  const allRels = [...stemRels, ...branchRels];
  const chongCount = allRels.filter(r => r.type?.includes('충')).length;
  const hapCount   = allRels.filter(r => r.type?.includes('합')).length;
  const hyungCount = branchRels.filter(r => r.type?.includes('형')).length;
  const paCount    = branchRels.filter(r => r.type?.includes('파')).length;
  const instability = chongCount + hyungCount + paCount;
  const dynamic     = chongCount + hapCount;

  let eScore = (tg('비견')+tg('겁재'))*2.0 + (tg('식신')+tg('상관'))*1.0 + oh('화')*0.8;
  let iScore = (tg('정인')+tg('편인'))*2.0 + oh('금')*0.8;
  if ((tg('정인')+tg('편인')) >= 3) iScore += 1.0;

  let nScore = oh('수')*1.5 + oh('목')*1.0 + (tg('식신')+tg('상관'))*0.8;
  let sScore = oh('토')*1.2 + oh('금')*0.8 + (tg('정관')+tg('편관'))*0.6;
  if (dynamic >= 2)      nScore += dynamic * 0.6;
  else if (dynamic === 1) nScore += 0.3;
  if (instability === 0 && (oh('토')+oh('금')) >= 3) sScore += 1.2;
  else if (instability === 0 && oh('토') >= 2) sScore += 0.6;

  let tScore = oh('금')*1.5 + (tg('정관')+tg('편관'))*1.0 + oh('토')*0.5;
  let fScore = oh('수')*1.5 + (tg('식신')+tg('상관'))*1.0 + oh('목')*0.5;

  let jScore = (tg('정관')+tg('편관'))*1.5 + (tg('정인')+tg('편인'))*0.8 + oh('토')*0.8 + oh('금')*0.5;
  let pScore = (tg('비견')+tg('겁재'))*1.0 + (tg('식신')+tg('상관'))*1.2 + oh('수')*0.8;
  if (instability > 0) pScore += instability * 1.2;
  if (instability === 0 && (oh('토')+oh('금')) >= 3) jScore += 0.8;

  const scores = {
    E: Math.round(eScore*100)/100, I: Math.round(iScore*100)/100,
    N: Math.round(nScore*100)/100, S: Math.round(sScore*100)/100,
    T: Math.round(tScore*100)/100, F: Math.round(fScore*100)/100,
    J: Math.round(jScore*100)/100, P: Math.round(pScore*100)/100,
  };

  let mbti = '';
  for (const [a,b] of [['E','I'],['N','S'],['T','F'],['J','P']])
    mbti += scores[a] >= scores[b] ? a : b;

  const confidence = {};
  for (const [a,b] of [['E','I'],['N','S'],['T','F'],['J','P']]) {
    const total = scores[a] + scores[b];
    if (total > 0) {
      const winner = scores[a] >= scores[b] ? a : b;
      confidence[`${a}/${b}`] = {result: winner, ratio: Math.round(Math.max(scores[a],scores[b])/total*1000)/10};
    } else {
      confidence[`${a}/${b}`] = {result:'판별불가', ratio:50.0};
    }
  }
  return {mbti, scores, confidence};
}

// =====================================================================
// 5. 시스템 프롬프트
// =====================================================================
const COMBINED_SYSTEM_PROMPT = `# Role
당신은 사주명리학과 MBTI 심리학을 결합하여 분석하는 트렌디하고 통찰력 있는 전문가입니다.

# Core Objective
입력된 사주 원국 데이터를 바탕으로, 대중이 읽기 쉽고 흥미로운 형태의 사주-MBTI 분석 리포트를 작성합니다.

# Tone & Manner
- 고객에게 직접 이야기하듯 친근하고 직관적인 대화체("~해요", "~입니다")를 사용합니다.
- 지루하거나 기계적인 설명(예: "결과: XX, 근거: YY")을 절대 피하고, 자연스럽게 흐르는 스토리텔링 방식을 채택합니다.
- 이모지를 적극적으로 활용하여 시각적인 재미를 더합니다.

# Formatting Rules
- 핵심 키워드나 결과는 반드시 **볼드체**로 강조합니다.
- 문단을 짧게 끊어 쓰고, 인용구(>)나 체크리스트(✔), 화살표(👉) 등을 사용하여 가독성을 극대화합니다.
- 섹션별로 숫자를 매긴 제목(1️⃣, 2️⃣ 등)을 사용하여 단계를 나눕니다.

# Strict Constraints
1. **비율 제한 (2:8 법칙):** 어려운 사주 전문 용어(십성, 천간지지 이름 등)의 노출은 전체 텍스트의 20% 이내로 제한합니다. 나머지 80%는 누구나 이해할 수 있는 일상적인 비유와 심리적 특징, 행동 패턴으로 풀어서 설명합니다.
2. **명칭 왜곡 금지:** 입력된 사주 명칭(예: 계수, 갑목 등)을 임의의 비유적 단어로 완전히 대체하여 부르지 마십시오. "계수는 쉽게 말하면 잔잔한 물과 같아서~"와 같이 원 명칭을 유지하며 비유를 덧붙이는 방식만 허용됩니다.
3. **MBTI 연결:** 도출된 사주의 성향이 MBTI의 어떤 지표(T/F, J/P, E/I, S/N)와 연결되는지 논리적인 이유를 제시합니다.
4. **단순 1:1 매핑 금지:** "토가 많으니 S", "충이 많으니 J" 같은 단편적 해석을 절대 금지합니다. 구조와 흐름, 행동 패턴으로 풀어내세요.

# MBTI 축별 해석 원칙
- **N/S:** 정보 처리 방식. 충/합이 많으면 현실 속에서도 해석·재구성하는 N 성향이 나타납니다.
- **T/F:** 판단 기준. 금+관성+토 구조 → 기준 기반 판단(T), 수+식상+목 구조 → 관계 기반 판단(F).
- **J/P:** 행동 방식. 충·형·파가 많으면 즉흥적 대응(P), 구조가 안정적이고 관성+인성이 강하면 계획적(J).

# Output Structure
## 1️⃣ 나의 사주, 한눈에 보기
(사주 원국과 일간의 핵심 기운을 스토리텔링으로 소개. 전문 용어는 쉬운 비유와 함께 사용)

## 2️⃣ 에너지 구조 분석
(오행 분포, 핵심 십성, 형충회합 등을 바탕으로 행동 패턴과 심리적 특징 서술. 전문 용어 20% 이하 유지)

## 3️⃣ 사주로 본 나의 MBTI는?

### ⚡ E vs I — 에너지 방향
(스토리텔링으로 설명, 마지막에 👉 **E 외향형 (약 XX%)** 형태로 결론)

### 🔭 N vs S — 정보 수집 방식
(스토리텔링으로 설명, 마지막에 👉 **N 직관형 (약 XX%)** 형태로 결론)

### ⚖️ T vs F — 판단 기준
(스토리텔링으로 설명, 마지막에 👉 **T 사고형 (약 XX%)** 형태로 결론)

### 🗓️ J vs P — 생활 방식
(스토리텔링으로 설명, 마지막에 👉 **J 판단형 (약 XX%)** 형태로 결론)

### 🏆 최종 MBTI 유력 후보
> 1순위: **XXXX** — 한 줄 캐릭터 요약
> 2순위: **XXXX** — 한 줄 캐릭터 요약
> 3순위: **XXXX** — 한 줄 캐릭터 요약

## 4️⃣ 나를 위한 현실 조언
✔ 강점: (핵심 강점 2~3가지)
✔ 주의할 점: (약점 또는 성장 포인트)
👉 오늘부터 실천할 것: (구체적인 행동 지침 1~2가지)`;

// =====================================================================
// 6. OpenAI 호출
// =====================================================================
async function callOpenAI(apiKey, systemPrompt, userPrompt, model='gpt-4o-mini') {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {'Authorization':`Bearer ${apiKey}`, 'Content-Type':'application/json'},
    body: JSON.stringify({
      model,
      messages: [{role:'system',content:systemPrompt},{role:'user',content:userPrompt}],
      temperature: 0.8,
      max_tokens: 3000,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API 오류: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// =====================================================================
// 7. Cloudflare Pages Function 핸들러
// =====================================================================
export async function onRequestPost(context) {
  const {request, env} = context;

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
    return new Response(JSON.stringify({error:'요청 본문이 올바르지 않습니다.'}), {status:400, headers:corsHeaders});
  }

  const {year, month, day, hour, minute=0, mode='combined'} = body;

  if (!year || !month || !day || hour === undefined)
    return new Response(JSON.stringify({error:'year, month, day, hour는 필수입니다.'}), {status:400, headers:corsHeaders});

  try {
    // 사주 8자 계산
    const eightChars = dateToEightChars(year, month, day, hour);

    // 사주 분석
    const computed = computeSaju(eightChars);
    const llmPayload = buildLlmPayload(computed);

    // MBTI 계산
    const {mbti, scores, confidence} = calculateMbtiScores(
      computed['오행_기본분포'], computed['십성_요약'],
      computed['천간_관계'], computed['지지_관계']
    );

    // 유저 프롬프트
    const userPrompt = `## 사주 계산 데이터
사주 원국: ${JSON.stringify(llmPayload.pillars, null, null)}
일간: ${llmPayload.day_master} (${JSON.stringify(llmPayload.day_master_info)})
오행 분포: ${JSON.stringify(llmPayload.five_elements_count)}
십성 요약: ${JSON.stringify(llmPayload.ten_gods_summary)}
핵심 십성: ${JSON.stringify(llmPayload.core_ten_gods)}
12운성: ${JSON.stringify(llmPayload.twelve_states)}
천간 관계: ${llmPayload.stem_relations.length ? JSON.stringify(llmPayload.stem_relations) : '없음'}
지지 관계: ${llmPayload.branch_relations.length ? JSON.stringify(llmPayload.branch_relations) : '없음'}
신살: ${JSON.stringify(llmPayload.special_stars)}

## 산술 계산 결과 (참고용)
초기 MBTI: ${mbti}
산술 점수: ${JSON.stringify(scores)}
산술 확신도: ${JSON.stringify(confidence)}

위 데이터를 기반으로 [사주 요약 + MBTI 추정 + 종합 조언]을 시스템 프롬프트 양식에 맞춰 작성해.`;

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');

    const interpretation = await callOpenAI(apiKey, COMBINED_SYSTEM_PROMPT, userPrompt);

    return new Response(JSON.stringify({
      success: true,
      eight_chars: eightChars,
      pillars: computed['사주_원국'],
      day_master: computed['일간'],
      five_elements: computed['오행_기본분포'],
      five_elements_status: computed['오행_분석'],
      mbti: {type: mbti, scores, confidence},
      interpretation,
    }), {status:200, headers:corsHeaders});

  } catch (e) {
    return new Response(JSON.stringify({error: e.message}), {status:500, headers:corsHeaders});
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
