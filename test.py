from collections import Counter
import json
import os

try:
    from sajupy import calculate_saju
except ImportError as e:
    calculate_saju = None
    _SAJUPY_IMPORT_ERROR = e
else:
    _SAJUPY_IMPORT_ERROR = None

# ==============================================================
# 정적 데이터(상수)
# ==============================================================

CHAR_INFO = {
    '甲': ('목', 1), '乙': ('목', 0), '丙': ('화', 1), '丁': ('화', 0),
    '戊': ('토', 1), '己': ('토', 0), '庚': ('금', 1), '辛': ('금', 0),
    '壬': ('수', 1), '癸': ('수', 0),
    '子': ('수', 0), '丑': ('토', 0), '寅': ('목', 1), '卯': ('목', 0),
    '辰': ('토', 1), '巳': ('화', 1), '午': ('화', 0), '未': ('토', 0),
    '申': ('금', 1), '酉': ('금', 0), '戌': ('토', 1), '亥': ('수', 1),
}

ELEM_IDX = {'목': 0, '화': 1, '토': 2, '금': 3, '수': 4}
ELEM_HANJA = {'목': '木', '화': '火', '토': '土', '금': '金', '수': '水'}

JIJANGGAN = {
    '子': ['癸'],
    '丑': ['己', '癸', '辛'],
    '寅': ['甲', '丙', '戊'],
    '卯': ['乙'],
    '辰': ['戊', '乙', '癸'],
    '巳': ['丙', '戊', '庚'],
    '午': ['丁', '己'],
    '未': ['己', '丁', '乙'],
    '申': ['庚', '壬', '戊'],
    '酉': ['辛'],
    '戌': ['戊', '辛', '丁'],
    '亥': ['壬', '甲'],
}

TWELVE_STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양']
JIJI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
JANGSEONG_START = {'甲': 11, '乙': 6, '丙': 2, '丁': 9, '戊': 2, '己': 9, '庚': 5, '辛': 0, '壬': 8, '癸': 3}
IS_YANG_GAN = {'甲': True, '乙': False, '丙': True, '丁': False, '戊': True, '己': False, '庚': True, '辛': False, '壬': True, '癸': False}

GAN_POSITIONS = ['년간', '월간', '일간', '시간']
JI_POSITIONS = ['년지', '월지', '일지', '시지']

CHEONGAN_HAP = [
    ('甲', '己', '토'),
    ('乙', '庚', '금'),
    ('丙', '辛', '수'),
    ('丁', '壬', '목'),
    ('戊', '癸', '화'),
]

CHEONGAN_CHUNG = [('甲', '庚'), ('乙', '辛'), ('丙', '壬'), ('丁', '癸')]

YUKAP = [('子', '丑', '토'), ('寅', '亥', '목'), ('卯', '戌', '화'), ('辰', '酉', '금'), ('巳', '申', '수'), ('午', '未', '화')]
CHUNG = [('子', '午'), ('丑', '未'), ('寅', '申'), ('卯', '酉'), ('辰', '戌'), ('巳', '亥')]
SAMHAP = [(['申', '子', '辰'], '수'), (['亥', '卯', '未'], '목'), (['寅', '午', '戌'], '화'), (['巳', '酉', '丑'], '금')]
BANGHAP = [(['寅', '卯', '辰'], '목'), (['巳', '午', '未'], '화'), (['申', '酉', '戌'], '금'), (['亥', '子', '丑'], '수')]

HYUNG3 = [['寅', '巳', '申'], ['丑', '戌', '未']]
HYUNG2 = [['子', '卯']]
JAHYUNG = {'辰', '午', '酉', '亥'}

PA = [('子', '酉'), ('卯', '午'), ('寅', '亥'), ('巳', '申'), ('辰', '丑'), ('戌', '未')]
HAE = [('子', '未'), ('丑', '午'), ('寅', '巳'), ('卯', '辰'), ('申', '亥'), ('酉', '戌')]

SAMHAP_GROUP = {
    '寅': '寅午戌', '午': '寅午戌', '戌': '寅午戌',
    '申': '申子辰', '子': '申子辰', '辰': '申子辰',
    '巳': '巳酉丑', '酉': '巳酉丑', '丑': '巳酉丑',
    '亥': '亥卯未', '卯': '亥卯未', '未': '亥卯未',
}

SINSAL_TABLE = {
    '寅午戌': {'역마': '申', '도화': '卯', '화개': '戌', '겁살': '亥', '망신': '巳', '장성': '午'},
    '申子辰': {'역마': '寅', '도화': '酉', '화개': '辰', '겁살': '巳', '망신': '亥', '장성': '子'},
    '巳酉丑': {'역마': '亥', '도화': '午', '화개': '丑', '겁살': '寅', '망신': '申', '장성': '酉'},
    '亥卯未': {'역마': '巳', '도화': '子', '화개': '未', '겁살': '申', '망신': '寅', '장성': '卯'},
}

CHEONUL = {
    '甲': ['丑', '未'], '戊': ['丑', '未'],
    '乙': ['子', '申'], '己': ['子', '申'],
    '丙': ['亥', '酉'], '丁': ['亥', '酉'],
    '庚': ['寅', '午'], '辛': ['寅', '午'],
    '壬': ['卯', '巳'], '癸': ['卯', '巳']
}

MUNCHANG = {'甲': '巳', '乙': '午', '丙': '申', '丁': '酉', '戊': '申', '己': '酉', '庚': '亥', '辛': '子', '壬': '寅', '癸': '卯'}
HAKDANG = {'甲': '亥', '乙': '午', '丙': '寅', '丁': '酉', '戊': '寅', '己': '酉', '庚': '巳', '辛': '子', '壬': '申', '癸': '卯'}
GEUMYEO = {'甲': '辰', '乙': '巳', '丙': '未', '丁': '申', '戊': '未', '己': '申', '庚': '戌', '辛': '亥', '壬': '丑', '癸': '寅'}

# ==============================================================
# 유틸
# ==============================================================

def _validate_input(eight_chars):
    if not isinstance(eight_chars, list) or len(eight_chars) != 8:
        raise ValueError("입력값은 정확히 8개의 문자를 가진 리스트여야 합니다.")
    valid_gans = {'甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'}
    valid_jis = {'子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'}
    for i, ch in enumerate(eight_chars):
        if i % 2 == 0 and ch not in valid_gans:
            raise ValueError(f"천간 위치 오류: '{ch}'는 유효한 천간이 아닙니다.")
        if i % 2 == 1 and ch not in valid_jis:
            raise ValueError(f"지지 위치 오류: '{ch}'는 유효한 지지가 아닙니다.")


def _dedupe_dict_list(items, keys):
    seen = set()
    result = []
    for item in items:
        sig_parts = []
        for k in keys:
            v = item.get(k)
            if isinstance(v, list):
                v = tuple(v)
            sig_parts.append(v)
        sig = tuple(sig_parts)
        if sig not in seen:
            seen.add(sig)
            result.append(item)
    return result


def get_sipseong(day_stem, target_char):
    my_elem, my_yy = CHAR_INFO[day_stem]
    my_idx = ELEM_IDX[my_elem]
    t_elem, t_yy = CHAR_INFO[target_char]
    t_idx = ELEM_IDX[t_elem]
    same = (my_yy == t_yy)
    if my_idx == t_idx:
        return '비견' if same else '겁재'
    elif (my_idx + 1) % 5 == t_idx:
        return '식신' if same else '상관'
    elif (my_idx + 2) % 5 == t_idx:
        return '편재' if same else '정재'
    elif (t_idx + 2) % 5 == my_idx:
        return '편관' if same else '정관'
    elif (t_idx + 1) % 5 == my_idx:
        return '편인' if same else '정인'
    raise ValueError(f"십성 계산 실패: day_stem={day_stem}, target_char={target_char}")


def get_twelve_stage(day_stem, ji):
    start = JANGSEONG_START[day_stem]
    ji_idx = JIJI_ORDER.index(ji)
    stage_idx = (ji_idx - start) % 12 if IS_YANG_GAN[day_stem] else (start - ji_idx) % 12
    return TWELVE_STAGES[stage_idx]


def _count_oheng(eight_chars):
    oheng = {'목': 0, '화': 0, '토': 0, '금': 0, '수': 0}
    for ch in eight_chars:
        oheng[CHAR_INFO[ch][0]] += 1
    return oheng


def _oheng_status(count):
    if count == 0:
        return '없음(부족)'
    if count == 1:
        return '약함'
    if count == 2:
        return '보통'
    return '과다'


# ==============================================================
# 관계 / 신살 계산: description 없는 "사실값" 버전
# ==============================================================

def compute_cheongan_relations(gans):
    rels = []
    gan_pos = list(zip(GAN_POSITIONS, gans))
    for i in range(len(gan_pos)):
        for j in range(i + 1, len(gan_pos)):
            p1, g1 = gan_pos[i]
            p2, g2 = gan_pos[j]
            for a, b, elem in CHEONGAN_HAP:
                if {g1, g2} == {a, b}:
                    rels.append({
                        'type': '천간합',
                        'pair': [f'{p1}:{g1}', f'{p2}:{g2}'],
                        'element': elem
                    })
            for a, b in CHEONGAN_CHUNG:
                if {g1, g2} == {a, b}:
                    rels.append({
                        'type': '천간충',
                        'pair': [f'{p1}:{g1}', f'{p2}:{g2}']
                    })
    return _dedupe_dict_list(rels, ['type', 'pair', 'element'])


def compute_jiji_relations(jis):
    rels = []
    ji_pos = list(zip(JI_POSITIONS, jis))
    for i in range(len(ji_pos)):
        for j in range(i + 1, len(ji_pos)):
            p1, j1 = ji_pos[i]
            p2, j2 = ji_pos[j]
            for a, b, elem in YUKAP:
                if {j1, j2} == {a, b}:
                    rels.append({'type': '육합', 'pair': [f'{p1}:{j1}', f'{p2}:{j2}'], 'element': elem})
            for a, b in CHUNG:
                if {j1, j2} == {a, b}:
                    rels.append({'type': '충', 'pair': [f'{p1}:{j1}', f'{p2}:{j2}']})
            for a, b in PA:
                if {j1, j2} == {a, b}:
                    rels.append({'type': '파', 'pair': [f'{p1}:{j1}', f'{p2}:{j2}']})
            for a, b in HAE:
                if {j1, j2} == {a, b}:
                    rels.append({'type': '해', 'pair': [f'{p1}:{j1}', f'{p2}:{j2}']})
            if j1 == j2 and j1 in JAHYUNG:
                rels.append({'type': '자형', 'pair': [f'{p1}:{j1}', f'{p2}:{j2}']})

    for members, elem in SAMHAP:
        if all(m in jis for m in members):
            found = [f'{p}:{j}' for p, j in ji_pos if j in members]
            rels.append({'type': '삼합', 'members': found, 'element': elem})
        else:
            present = [m for m in members if m in jis]
            wang = members[1]
            if len(present) == 2 and wang in present:
                found = [f'{p}:{j}' for p, j in ji_pos if j in present]
                rels.append({'type': '반합', 'members': found, 'element': elem})

    for members, elem in BANGHAP:
        if all(m in jis for m in members):
            found = [f'{p}:{j}' for p, j in ji_pos if j in members]
            rels.append({'type': '방합', 'members': found, 'element': elem})

    for members in HYUNG3:
        if all(m in jis for m in members):
            found = [f'{p}:{j}' for p, j in ji_pos if j in members]
            rels.append({'type': '삼형', 'members': found})
        else:
            present = [m for m in members if m in jis]
            if len(present) == 2:
                found = [f'{p}:{j}' for p, j in ji_pos if j in present]
                rels.append({'type': '반형', 'members': found})

    for members in HYUNG2:
        if all(m in jis for m in members):
            found = [f'{p}:{j}' for p, j in ji_pos if j in members]
            rels.append({'type': '이형', 'members': found})

    return _dedupe_dict_list(rels, ['type', 'pair', 'members', 'element'])


def compute_sinsal(day_gan, year_ji, day_ji, jis):
    ji_pos = list(zip(JI_POSITIONS, jis))
    sinsal_results = []
    for basis_name, basis_ji in [('년지', year_ji), ('일지', day_ji)]:
        grp = SAMHAP_GROUP.get(basis_ji, '')
        if grp in SINSAL_TABLE:
            for sname, sji in SINSAL_TABLE[grp].items():
                for pos, ji in ji_pos:
                    if ji == sji:
                        sinsal_results.append({
                            'name': sname,
                            'position': f'{pos}:{ji}',
                            'basis': basis_name
                        })
    sinsal_results = _dedupe_dict_list(sinsal_results, ['name', 'position', 'basis'])

    gwiin_results = []
    for target_ji in CHEONUL.get(day_gan, []):
        for pos, ji in ji_pos:
            if ji == target_ji:
                gwiin_results.append({
                    'name': '천을귀인',
                    'position': f'{pos}:{ji}'
                })

    mc, hd, gy = MUNCHANG.get(day_gan), HAKDANG.get(day_gan), GEUMYEO.get(day_gan)
    for pos, ji in ji_pos:
        if ji == mc:
            gwiin_results.append({'name': '문창귀인', 'position': f'{pos}:{ji}'})
        if ji == hd:
            gwiin_results.append({'name': '학당귀인', 'position': f'{pos}:{ji}'})
        if ji == gy:
            gwiin_results.append({'name': '금여록', 'position': f'{pos}:{ji}'})

    gwiin_results = _dedupe_dict_list(gwiin_results, ['name', 'position'])
    return sinsal_results, gwiin_results


# ==============================================================
# 내부 계산 결과
# ==============================================================

def compute_saju(eight_chars):
    _validate_input(eight_chars)
    year_gan, year_ji = eight_chars[0], eight_chars[1]
    month_gan, month_ji = eight_chars[2], eight_chars[3]
    day_gan, day_ji = eight_chars[4], eight_chars[5]
    hour_gan, hour_ji = eight_chars[6], eight_chars[7]

    gans = [year_gan, month_gan, day_gan, hour_gan]
    jis = [year_ji, month_ji, day_ji, hour_ji]

    my_elem, my_yy = CHAR_INFO[day_gan]
    oheng = _count_oheng(eight_chars)
    oheng_analysis = {e: _oheng_status(c) for e, c in oheng.items()}

    cheongan_sipseong = {}
    for idx, gan in enumerate(gans):
        pos = GAN_POSITIONS[idx]
        cheongan_sipseong[pos] = '일간(나)' if pos == '일간' else get_sipseong(day_gan, gan)

    jiji_main_sipseong = {}
    jijanggan_sipseong = {}
    hidden_tengods = []
    for idx, ji in enumerate(jis):
        pos = JI_POSITIONS[idx]
        hidden = JIJANGGAN[ji]
        main_tg = get_sipseong(day_gan, hidden[0])
        full_tg = [(g, get_sipseong(day_gan, g)) for g in hidden]
        jiji_main_sipseong[pos] = main_tg
        jijanggan_sipseong[pos] = {
            '지지': ji,
            '장간': full_tg
        }
        hidden_tengods.extend([tg for _, tg in full_tg])

    gan_tengods = [v for k, v in cheongan_sipseong.items() if k != '일간']
    total_tengods = gan_tengods + hidden_tengods
    sipseong_counts = dict(Counter(total_tengods))
    core_sipseong = dict(Counter(total_tengods).most_common(3))
    twelve_stages = {JI_POSITIONS[idx]: get_twelve_stage(day_gan, ji) for idx, ji in enumerate(jis)}

    cheongan_relations = compute_cheongan_relations(gans)
    jiji_relations = compute_jiji_relations(jis)
    sinsal_results, gwiin_results = compute_sinsal(day_gan, year_ji, day_ji, jis)

    return {
        '사주_원국': {
            '년주': f'{year_gan}{year_ji}',
            '월주': f'{month_gan}{month_ji}',
            '일주': f'{day_gan}{day_ji}',
            '시주': f'{hour_gan}{hour_ji}',
        },
        '일간': day_gan,
        '일간_오행': {
            'element_ko': my_elem,
            'element_hanja': ELEM_HANJA[my_elem],
            'yin_yang': '양' if my_yy else '음'
        },
        '오행_기본분포': oheng,
        '오행_분석': oheng_analysis,
        '천간_십성': cheongan_sipseong,
        '지지_주기십성': jiji_main_sipseong,
        '지장간_십성': jijanggan_sipseong,
        '십성_요약': sipseong_counts,
        '핵심_십성': core_sipseong,
        '십이운성': twelve_stages,
        '천간_관계': cheongan_relations,
        '지지_관계': jiji_relations,
        '십이신살': sinsal_results,
        '귀인_신살': gwiin_results,
    }


# ==============================================================
# LLM 전달용 최소 스키마
# ==============================================================

def build_llm_payload(computed):
    return {
        'pillars': computed['사주_원국'],
        'day_master': computed['일간'],
        'day_master_info': computed['일간_오행'],
        'five_elements_count': computed['오행_기본분포'],
        'ten_gods_summary': computed['십성_요약'],
        'core_ten_gods': computed['핵심_십성'],
        'twelve_states': computed['십이운성'],
        'stem_relations': [
            {'type': item['type'], 'pair': item.get('pair', []), 'element': item.get('element')}
            for item in computed['천간_관계']
        ],
        'branch_relations': [
            {
                'type': item['type'],
                'pair': item.get('pair', []),
                'members': item.get('members', []),
                'element': item.get('element')
            }
            for item in computed['지지_관계']
        ],
        'special_stars': {
            'sinsal_names': sorted(list(set([item['name'] for item in computed['십이신살']]))),
            'gwiin_names': sorted(list(set([item['name'] for item in computed['귀인_신살']]))),
        }
    }


# ==============================================================
# 리포트용 문장 재료
# ==============================================================

def build_report_source(computed):
    return {
        'pillars': computed['사주_원국'],
        'day_master': computed['일간'],
        'five_elements_count': computed['오행_기본분포'],
        'five_elements_status': computed['오행_분석'],
        'ten_gods_summary': computed['십성_요약'],
        'core_ten_gods': computed['핵심_십성'],
        'twelve_states': computed['십이운성'],
        'stem_relation_types': [x['type'] for x in computed['천간_관계']],
        'branch_relation_types': [x['type'] for x in computed['지지_관계']],
        'special_star_names': sorted(list(set(
            [item['name'] for item in computed['십이신살']] +
            [item['name'] for item in computed['귀인_신살']]
        )))
    }


# ==============================================================
# 최종 API 응답 구조
# ==============================================================

def analyze_saju_for_backend(eight_chars):
    computed = compute_saju(eight_chars)
    return {
        'raw_input': {
            'eight_chars': eight_chars
        },
        'computed': computed,
        'llm_payload': build_llm_payload(computed),
        'report_source': build_report_source(computed)
    }


# ==============================================================
# 사람 읽기용 리포트
# ==============================================================

def format_saju_report(report_source):
    lines = []
    lines.append("# 사주 분석 요약")
    lines.append("")
    lines.append("## 사주 원국")
    for k, v in report_source['pillars'].items():
        lines.append(f"- {k}: {v}")
    lines.append("")
    lines.append(f"## 일간")
    lines.append(f"- {report_source['day_master']}")
    lines.append("")
    lines.append("## 오행 분포")
    for k, v in report_source['five_elements_count'].items():
        lines.append(f"- {k}: {v} ({report_source['five_elements_status'][k]})")
    lines.append("")
    lines.append("## 핵심 십성")
    for k, v in report_source['core_ten_gods'].items():
        lines.append(f"- {k}: {v}")
    lines.append("")
    lines.append("## 십이운성")
    for k, v in report_source['twelve_states'].items():
        lines.append(f"- {k}: {v}")
    lines.append("")
    lines.append("## 관계 키워드")
    lines.append(f"- 천간 관계: {', '.join(report_source['stem_relation_types']) if report_source['stem_relation_types'] else '없음'}")
    lines.append(f"- 지지 관계: {', '.join(report_source['branch_relation_types']) if report_source['branch_relation_types'] else '없음'}")
    lines.append("")
    lines.append("## 주요 신살 키워드")
    lines.append(f"- {', '.join(report_source['special_star_names']) if report_source['special_star_names'] else '없음'}")
    return '\n'.join(lines)


# ==============================================================
# MBTI 점수 계산 (v2 — 행동 패턴 기반 재설계)
#
# 핵심 변경 철학:
#   "명리 해석 → MBTI 억지 변환"  ❌
#   "명리 구조 → 행동 패턴 → MBTI 번역"  ✅
#
# 수정 프레임:
#   N/S: S = 토+금+관성+안정구조  |  N = 수+목+식상+충/합
#   T/F: T = 금+관성+토           |  F = 수+식상+목
#   J/P: J = 토+금+관성+인성      |  P = 수+비겁+식상+충/형/파
# ==============================================================

def calculate_mbti_scores(oheng, ten_gods_summary, stem_relations, branch_relations):
    def get_tg(name):
        return ten_gods_summary.get(name, 0)

    def get_oh(name):
        return oheng.get(name, 0)

    scores = {}

    # ── 0. 동적 구조 카운트 (합·충·형·파) ──
    all_relations = stem_relations + branch_relations

    chong_count = sum(1 for r in all_relations if '충' in r.get('type', ''))
    hap_count = sum(1 for r in all_relations if '합' in r.get('type', ''))
    hyung_count = sum(1 for r in branch_relations if '형' in r.get('type', ''))
    pa_count = sum(1 for r in branch_relations if '파' in r.get('type', ''))

    # 구조 불안정 지표: 충 + 형 + 파 (변동성·즉흥성의 근거)
    instability_count = chong_count + hyung_count + pa_count
    # 동적 해석 지표: 충 + 합 (정보를 재해석·재구성하려는 성향의 근거)
    dynamic_interaction_count = chong_count + hap_count

    # ── 1. [E vs I] ──
    # E: 비겁(외부 활동·사교) + 식상(표현·발산) + 화(에너지 방출)
    # I: 인성(내면 수용·사색) + 금(수렴·절제)
    e_score = (
        (get_tg('비견') + get_tg('겁재')) * 2.0
        + (get_tg('식신') + get_tg('상관')) * 1.0
        + get_oh('화') * 0.8
    )
    i_score = (
        (get_tg('정인') + get_tg('편인')) * 2.0
        + get_oh('금') * 0.8
    )
    # 인성 과다 시 내향 보정
    if (get_tg('정인') + get_tg('편인')) >= 3:
        i_score += 1.0

    # ── 2. [N vs S] — "정보 처리 방식" 기반 재설계 ──
    #
    # 기존 문제: 토 많음 → 무조건 S (단순 매핑)
    # 수정 철학: MBTI N/S는 "정보를 있는 그대로 받아들이냐 vs 해석·재구성하냐"
    #
    # N = 수(해석형) + 목(확장·가능성) + 식상(새로운 아이디어 생산)
    #     + 충/합이 많으면 "계속 해석하는 구조" → N 보정
    # S = 토(현실·안정) + 금(분석·정리) + 관성(규칙·기준 수용)
    #     + 구조가 안정적(충/형/파 없음)일 때만 강한 S
    n_score = (
        get_oh('수') * 1.5
        + get_oh('목') * 1.0
        + (get_tg('식신') + get_tg('상관')) * 0.8
    )
    s_score = (
        get_oh('토') * 1.2
        + get_oh('금') * 0.8
        + (get_tg('정관') + get_tg('편관')) * 0.6
    )

    # 동적 해석 구조(충+합)가 2개 이상이면 → 현실 속에서도 해석·재구성하는 패턴
    if dynamic_interaction_count >= 2:
        n_score += dynamic_interaction_count * 0.6

    # 충+합이 1개라도 있으면 약한 N 보정
    elif dynamic_interaction_count == 1:
        n_score += 0.3

    # 토+금이 풍부하면서 구조까지 안정적일 때만 강력한 S
    if instability_count == 0 and (get_oh('토') + get_oh('금')) >= 3:
        s_score += 1.2
    elif instability_count == 0 and get_oh('토') >= 2:
        s_score += 0.6

    # ── 3. [T vs F] — "판단 기준" 기반 재설계 ──
    #
    # 기존 문제: 편관 → 논리적 → T (편관은 논리가 아니라 "외부 기준 수용")
    # 수정 철학:
    #   T = 금(분석·분리·객관) + 관성(기준·규칙) + 토(현실 근거)
    #       → "기준과 원칙에 맞는 판단을 선호"
    #   F = 수(감정 흐름·공감) + 식상(감정 표현·발산) + 목(성장·배려)
    #       → "상황과 관계를 고려한 판단을 선호"
    t_score = (
        get_oh('금') * 1.5
        + (get_tg('정관') + get_tg('편관')) * 1.0
        + get_oh('토') * 0.5
    )
    f_score = (
        get_oh('수') * 1.5
        + (get_tg('식신') + get_tg('상관')) * 1.0
        + get_oh('목') * 0.5
    )

    # ── 4. [J vs P] — "행동 방식" 기반 재설계 ──
    #
    # 기존 문제: 충 많음 → 계획 필요 → J (완전히 반대!)
    # 수정 철학:
    #   충 많음 → 변화 많음 → 즉흥 대응 → P
    #   J = 토(안정·체계) + 금(절제·정리) + 관성(규칙 준수) + 인성(수용·준비)
    #   P = 수(유동·적응) + 비겁(독립 행동) + 식상(즉흥 발산) + 충/형/파(변동성)
    j_score = (
        (get_tg('정관') + get_tg('편관')) * 1.5
        + (get_tg('정인') + get_tg('편인')) * 0.8
        + get_oh('토') * 0.8
        + get_oh('금') * 0.5
    )
    p_score = (
        (get_tg('비견') + get_tg('겁재')) * 1.0
        + (get_tg('식신') + get_tg('상관')) * 1.2
        + get_oh('수') * 0.8
    )

    # 충/형/파로 인한 구조 불안정 → P(변동성·즉흥성) 증가
    if instability_count > 0:
        p_score += instability_count * 1.2

    # 구조가 완전히 안정적(충/형/파 0)이고 토+금 풍부 → J 보강
    if instability_count == 0 and (get_oh('토') + get_oh('금')) >= 3:
        j_score += 0.8

    # ── 5. 결과 조립 ──
    for label, a, b in [('EI', e_score, i_score),
                        ('NS', n_score, s_score),
                        ('TF', t_score, f_score),
                        ('JP', j_score, p_score)]:
        scores[label[0]] = round(a, 2)
        scores[label[1]] = round(b, 2)

    mbti = ''
    for a_label, b_label in [('E', 'I'), ('N', 'S'), ('T', 'F'), ('J', 'P')]:
        mbti += a_label if scores[a_label] >= scores[b_label] else b_label

    confidence = {}
    for a_label, b_label in [('E', 'I'), ('N', 'S'), ('T', 'F'), ('J', 'P')]:
        total = scores[a_label] + scores[b_label]
        if total > 0:
            winner = a_label if scores[a_label] >= scores[b_label] else b_label
            confidence[f'{a_label}/{b_label}'] = {
                'result': winner,
                'ratio': round(max(scores[a_label], scores[b_label]) / total * 100, 1)
            }
        else:
            confidence[f'{a_label}/{b_label}'] = {'result': '판별불가', 'ratio': 50.0}

    return mbti, scores, confidence


def get_eight_chars_from_sajupy(
    year: int,
    month: int,
    day: int,
    hour: int,
    minute: int = 0,
    **sajupy_kwargs
) -> list[str]:
    """
    생년월일시를 sajupy에 전달해 사주 8자를
    [년간, 년지, 월간, 월지, 일간, 일지, 시간, 시지] 형식으로 반환한다.
    """
    if calculate_saju is None:
        raise ImportError(f"sajupy import 실패: {_SAJUPY_IMPORT_ERROR}")

    saju_dict = calculate_saju(
        year=year,
        month=month,
        day=day,
        hour=hour,
        minute=minute,
        **sajupy_kwargs
    )

    required_keys = [
        'year_stem', 'year_branch',
        'month_stem', 'month_branch',
        'day_stem', 'day_branch',
        'hour_stem', 'hour_branch',
    ]
    missing = [k for k in required_keys if k not in saju_dict]
    if missing:
        raise KeyError(f"sajupy 반환값에 필요한 키가 없습니다: {missing}")

    eight_chars = [
        saju_dict['year_stem'], saju_dict['year_branch'],
        saju_dict['month_stem'], saju_dict['month_branch'],
        saju_dict['day_stem'], saju_dict['day_branch'],
        saju_dict['hour_stem'], saju_dict['hour_branch'],
    ]
    return eight_chars


def analyze_user_birth_input(
    year: int,
    month: int,
    day: int,
    hour: int,
    minute: int = 0,
    **sajupy_kwargs
):
    eight_chars = get_eight_chars_from_sajupy(
        year=year,
        month=month,
        day=day,
        hour=hour,
        minute=minute,
        **sajupy_kwargs
    )
    return analyze_saju_for_backend(eight_chars)


# ==============================================================
# GPT 연동 모듈
# ==============================================================

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


# ─────────────────────────────────────────
# 1. 클라이언트 초기화
# ─────────────────────────────────────────

def _get_openai_client(api_key=None):
    if OpenAI is None:
        raise ImportError("openai 패키지가 설치되어 있지 않습니다. pip install openai")
    key = api_key or os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")
    return OpenAI(api_key=key)


# ─────────────────────────────────────────
# 2. 시스템 프롬프트
# ─────────────────────────────────────────

SAJU_SYSTEM_PROMPT = """당신은 사주명리학 전문가이자 심리 상담사입니다.
아래 규칙을 반드시 따르세요:

[역할]
- 사용자에게 제공된 사주 계산 데이터(오행, 십성, 12운성, 신살, 형충회합 등)를 기반으로
  성격, 적성, 대인관계, 주의사항 등을 해석합니다.
- 모든 해석은 제공된 계산 데이터에 근거해야 하며, 데이터에 없는 내용을 지어내지 마세요.

[문체]
- 따뜻하고 친근한 말투 (반말 OK)
- 이모지를 적절히 사용
- 전문 용어를 쓸 때는 괄호 안에 쉬운 설명 추가
- "쉽게 말하면" 섹션으로 일상 비유 제공 💡

[구조]
1. 사주 원국 요약 (한눈에 보기) 📋
2. 오행 분석 (강한 것, 부족한 것, 의미) 🌊
3. 핵심 십성 해석 (성격·적성·관계) ⭐
4. 12운성 해석 (현재 에너지 상태) 🔄
5. 특수 관계 해석 (합·충·형이 있으면) 🔗
6. 신살 해석 (역마, 도화, 귀인 등이 있으면) 🌟
7. 종합 조언 (3줄 요약) 💡

[금지사항]
- 수명, 사망, 불치병 등 공포를 조장하는 표현 금지
- "무조건 ~하세요" 같은 단정적 지시 금지
- 제공된 데이터 외의 사주 계산을 임의로 하지 마세요"""


MBTI_SYSTEM_PROMPT = """당신은 사주명리학 기반 MBTI 분석 전문가입니다.
아래 규칙을 반드시 따르세요:

[역할]
- 사주 데이터와 MBTI 점수 계산 결과를 바탕으로
  각 MBTI 축(E/I, N/S, T/F, J/P)별 해석을 작성합니다.
- 점수와 확신도는 이미 계산되어 제공됩니다. 직접 계산하지 마세요.

[핵심 해석 원칙 — 반드시 준수]
- N/S 해석 시: "토가 많아서 현실적이다 → S"처럼 단순 매핑하지 마세요.
  대신 "현실 기반은 강하지만, 충합 구조로 인해 상황을 해석하고 재구성하는 성향이 함께 나타납니다"
  처럼 구조적 흐름으로 설명하세요.
- T/F 해석 시: "편관이 있어서 논리적이다"라고 하지 마세요.
  대신 "외부 기준과 규칙을 중시하는 성향이 있어, 감정보다는 기준에 맞는 판단을 선호합니다"
  처럼 행동 패턴으로 번역하세요.
- J/P 해석 시: "충이 많아서 계획적이다"라고 절대 하지 마세요.
  대신 "변동성이 있는 구조라 상황에 맞춰 유연하게 대응하는 경향이 있습니다"
  처럼 실제 행동 방식으로 설명하세요.

[구조] — 각 축마다:
1. 결론 (예: I 내향형) + 확신도 👉
2. 이유 — 사주 용어(오행·십성·일간)로 설명 📊
3. 쉽게 말하면 → 일상 행동 비유 한 줄 💡
4. 확신도 60% 미만이면 "경계선" 표시 ⚠

[마무리]
- 최종 MBTI 타입 + 한 줄 캐릭터 요약
- 이 MBTI의 강점/약점을 사주 관점에서 1~2줄

[문체]
- 친근한 말투, 이모지 사용
- 전문 용어에는 쉬운 설명 괄호 추가"""


COMBINED_SYSTEM_PROMPT = """[역할]
너는 사주 명리학의 구조적 상호작용(합, 충, 생극제화)을 분석하여, 이를 현대인의 실제 행동 패턴과 MBTI로 변환하는 최고 수준의 명리-심리 분석가다.

[핵심 분석 원칙]
1. 단순 1:1 매핑 금지: "토가 많으니 현실적(S)"과 같은 단편적인 해석을 절대 금지한다.
2. 구조와 흐름 파악: 오행의 개수보다 일간과의 관계, 지지의 합/충, 상호작용이 만드는 '행동 양식'을 우선하여 분석한다. 파이썬에서 계산된 점수가 제공되더라도 맹신하지 말고 사주 원국 전체 구조를 보고 MBTI를 자체적으로 보정 및 추론하라.
3. 행동 기반 번역: 추상적 자연물 비유를 버리고, 구체적인 일상 행동 패턴으로 설명하라.

[MBTI 축별 해석 가이드라인 — 반드시 준수]
- N/S: "정보 처리 방식"이다. 토가 많다고 무조건 S가 아니다.
  충/합이 많으면 "현실 속에서도 계속 해석하고 재구성하는 구조"이므로 N 성향이 나타난다.
  토+금이 풍부하면서 구조까지 안정적(충/형/파 없음)일 때만 강력한 S다.
- T/F: "판단 기준"이다. 편관은 '논리'가 아니라 '외부 기준 수용'이다.
  금(분석·객관) + 관성(기준·규칙) + 토(현실 근거) → T (기준 기반 판단)
  수(감정 흐름) + 식상(감정 표현) + 목(배려·성장) → F (관계 기반 판단)
- J/P: "행동 방식"이다. 충이 많다고 계획적(J)인 게 절대 아니다.
  충 많음 → 변화 많음 → 즉흥 대응 → P다.
  토+금+관성+인성이 강하고 구조가 안정적일 때 J다.

[출력 구조]
## 파트 1: 사주 요약
- 사주 원국: (년주, 월주, 일주, 시주) 📋
- 일간: (일간 특성 요약) 👤

## 파트 2: 사주 기반 MBTI 추정
### E vs I
- 결과: [E 또는 I] (※ 확실하지 않을 시 비율 표기 예: 55 : 45)
- 사주 근거: (작용 및 구조 기반 분석)
- 쉽게 말하면: (행동 패턴 비유) 💡

### N vs S
- 결과: [N 또는 S]
- 사주 근거: (작용 및 구조 기반 분석)
- 쉽게 말하면: (행동 패턴 비유) 💡

### T vs F
- 결과: [T 또는 F]
- 사주 근거: (작용 및 구조 기반 분석)
- 쉽게 말하면: (행동 패턴 비유) 💡

### J vs P
- 결과: [J 또는 P]
- 사주 근거: (작용 및 구조 기반 분석)
- 쉽게 말하면: (행동 패턴 비유) 💡

### 최종 MBTI 추정: [최종 결과 4글자]

## 파트 3: 종합 조언
- 강점: (핵심 강점)
- 약점: (핵심 약점)
- 현실적인 조언: (행동 지침)"""


# ─────────────────────────────────────────
# 3. 유저 프롬프트 빌더
# ─────────────────────────────────────────

def _build_saju_user_prompt(llm_payload):
    """사주 해석용 유저 프롬프트"""
    return f"""## 사주 계산 데이터
사주 원국: {json.dumps(llm_payload['pillars'], ensure_ascii=False)}
일간(Day Master): {llm_payload['day_master']}
일간 정보: {json.dumps(llm_payload['day_master_info'], ensure_ascii=False)}
오행 분포: {json.dumps(llm_payload['five_elements_count'], ensure_ascii=False)}
십성 요약: {json.dumps(llm_payload['ten_gods_summary'], ensure_ascii=False)}
핵심 십성 (상위 3개): {json.dumps(llm_payload['core_ten_gods'], ensure_ascii=False)}
12운성: {json.dumps(llm_payload['twelve_states'], ensure_ascii=False)}
천간 관계: {json.dumps(llm_payload['stem_relations'], ensure_ascii=False) if llm_payload['stem_relations'] else '없음'}
지지 관계: {json.dumps(llm_payload['branch_relations'], ensure_ascii=False) if llm_payload['branch_relations'] else '없음'}
신살: {json.dumps(llm_payload['special_stars'], ensure_ascii=False)}

위 데이터를 기반으로 사주 해석을 작성해주세요."""


def _build_mbti_user_prompt(llm_payload, mbti, scores, confidence):
    """MBTI 해석용 유저 프롬프트"""
    return f"""## 사주 데이터
사주 원국: {json.dumps(llm_payload['pillars'], ensure_ascii=False)}
일간: {llm_payload['day_master']} ({json.dumps(llm_payload['day_master_info'], ensure_ascii=False)})
오행 분포: {json.dumps(llm_payload['five_elements_count'], ensure_ascii=False)}
핵심 십성: {json.dumps(llm_payload['core_ten_gods'], ensure_ascii=False)}
12운성: {json.dumps(llm_payload['twelve_states'], ensure_ascii=False)}

## MBTI 계산 결과 (파이썬으로 계산 완료됨 — 이 수치를 그대로 사용하세요)
최종 MBTI: {mbti}
점수: {json.dumps(scores)}
확신도: {json.dumps(confidence, ensure_ascii=False)}

위 데이터를 기반으로 각 MBTI 축별 해석을 작성해주세요."""


def _build_combined_user_prompt(llm_payload, mbti, scores, confidence):
    """종합 해석용 유저 프롬프트"""
    return f"""## 사주 계산 데이터
사주 원국: {json.dumps(llm_payload['pillars'], ensure_ascii=False)}
일간: {llm_payload['day_master']} ({json.dumps(llm_payload['day_master_info'], ensure_ascii=False)})
오행 분포: {json.dumps(llm_payload['five_elements_count'], ensure_ascii=False)}
십성 요약: {json.dumps(llm_payload['ten_gods_summary'], ensure_ascii=False)}
핵심 십성: {json.dumps(llm_payload['core_ten_gods'], ensure_ascii=False)}
12운성: {json.dumps(llm_payload['twelve_states'], ensure_ascii=False)}
천간 관계: {json.dumps(llm_payload['stem_relations'], ensure_ascii=False) if llm_payload['stem_relations'] else '없음'}
지지 관계: {json.dumps(llm_payload['branch_relations'], ensure_ascii=False) if llm_payload['branch_relations'] else '없음'}
신살: {json.dumps(llm_payload['special_stars'], ensure_ascii=False)}

## 기본 산술 계산 결과 (참고용으로만 사용하고, 사주 구조상 모순이 있다면 무시하고 독자적인 MBTI를 도출할 것)
초기 MBTI 예측: {mbti}
산술 점수: {json.dumps(scores)}
산술 확신도: {json.dumps(confidence, ensure_ascii=False)}

위 데이터를 기반으로 [사주 요약 + 사주 기반 MBTI 추정 + 종합 조언]을 시스템 프롬프트 양식에 맞춰 엄격하게 작성해."""


# ─────────────────────────────────────────
# 4. GPT 호출 함수
# ─────────────────────────────────────────

def call_gpt(
    system_prompt: str,
    user_prompt: str,
    api_key: str = None,
    model: str = "gpt-4o-mini",
    temperature: float = 0.8,
    max_tokens: int = 3000,
) -> str:
    """GPT API 호출 → 응답 텍스트 반환"""
    client = _get_openai_client(api_key)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


def call_gpt_stream(
    system_prompt: str,
    user_prompt: str,
    api_key: str = None,
    model: str = "gpt-4o-mini",
    temperature: float = 0.8,
    max_tokens: int = 3000,
):
    """GPT API 스트리밍 호출 → 제너레이터로 토큰 반환"""
    client = _get_openai_client(api_key)
    stream = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


# ─────────────────────────────────────────
# 5. 통합 API 함수 (이것만 호출하면 끝)
# ─────────────────────────────────────────

def interpret_saju(
    eight_chars: list,
    mode: str = "combined",
    api_key: str = None,
    model: str = "gpt-4o-mini",
    stream: bool = False,
):
    """
    사주 8자를 넣으면 계산 + GPT 해석까지 한 번에.

    Parameters:
        eight_chars: [년간, 년지, 월간, 월지, 일간, 일지, 시간, 시지]
        mode: "saju" | "mbti" | "combined"
        api_key: OpenAI API 키 (없으면 환경변수 사용)
        model: GPT 모델명
        stream: True면 스트리밍 제너레이터 반환

    Returns:
        dict: {
            'computed': 계산 결과,
            'mbti': MBTI 결과,
            'interpretation': GPT 해석 텍스트 (stream=False일 때)
            'stream': 제너레이터 (stream=True일 때)
        }
    """
    # 1) 사주 계산
    backend_result = analyze_saju_for_backend(eight_chars)
    llm_payload = backend_result['llm_payload']
    computed = backend_result['computed']

    # 2) MBTI 계산
    mbti, scores, confidence = calculate_mbti_scores(
        computed['오행_기본분포'],
        computed['십성_요약'],
        computed['천간_관계'],
        computed['지지_관계']
    )

    # 3) 프롬프트 선택
    if mode == "saju":
        system_prompt = SAJU_SYSTEM_PROMPT
        user_prompt = _build_saju_user_prompt(llm_payload)
    elif mode == "mbti":
        system_prompt = MBTI_SYSTEM_PROMPT
        user_prompt = _build_mbti_user_prompt(llm_payload, mbti, scores, confidence)
    else:  # combined
        system_prompt = COMBINED_SYSTEM_PROMPT
        user_prompt = _build_combined_user_prompt(llm_payload, mbti, scores, confidence)

    # 4) GPT 호출
    result = {
        'computed': computed,
        'mbti': {
            'type': mbti,
            'scores': scores,
            'confidence': confidence,
        },
        'llm_payload': llm_payload,
    }

    if stream:
        result['stream'] = call_gpt_stream(
            system_prompt, user_prompt,
            api_key=api_key, model=model
        )
    else:
        result['interpretation'] = call_gpt(
            system_prompt, user_prompt,
            api_key=api_key, model=model
        )

    return result


def interpret_birth(
    year: int, month: int, day: int, hour: int,
    minute: int = 0,
    mode: str = "combined",
    api_key: str = None,
    model: str = "gpt-4o",
    stream: bool = False,
    **sajupy_kwargs,
):
    """
    생년월일시를 넣으면 sajupy → 계산 → GPT 해석까지 한 번에.
    """
    eight_chars = get_eight_chars_from_sajupy(
        year, month, day, hour, minute, **sajupy_kwargs
    )
    return interpret_saju(
        eight_chars, mode=mode,
        api_key=api_key, model=model, stream=stream
    )


# ─────────────────────────────────────────
# 6. 테스트
# ─────────────────────────────────────────

if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()

    MY_KEY = os.getenv("OPENAI_API_KEY")

    try:
        from korean_lunar_calendar import KoreanLunarCalendar
    except ImportError:
        KoreanLunarCalendar = None
        print("[경고] korean_lunar_calendar 모듈이 설치되지 않았습니다. 음력 변환 시 오류가 발생할 수 있습니다.")

    print("사주 분석을 위한 생년월일시 정보를 입력하세요.")
    try:
        year = int(input("연도 (예: 1995): "))
        month = int(input("월 (1~12): "))
        day = int(input("일 (1~31): "))
        hour = int(input("시 (0~23): "))
        minute = int(input("분 (0~59): "))

        gender_input = input("성별 (남자: M, 여자: F): ").strip().upper()

        calendar_input = input("양력/음력 (양력: 0, 음력: 1): ").strip()
        is_lunar = False
        is_leap_month = False

        if calendar_input == '1':
            is_lunar = True
            leap_input = input("윤달입니까? (예: Y, 아니오: N): ").strip().upper()
            if leap_input == 'Y':
                is_leap_month = True

        print("\n분석을 진행 중입니다...\n")

        # 음력일 경우 양력으로 변환하는 전처리 로직
        if is_lunar:
            if KoreanLunarCalendar is None:
                raise ImportError("음력을 처리하려면 터미널에서 'pip install korean_lunar_calendar'를 실행하십시오.")

            calendar = KoreanLunarCalendar()
            calendar.setLunarDate(year, month, day, is_leap_month)

            if calendar.isValid():
                year = calendar.solarYear
                month = calendar.solarMonth
                day = calendar.solarDay
                print(f"[안내] 입력하신 음력 날짜는 양력 {year}년 {month}월 {day}일로 변환되어 계산됩니다.\n")
            else:
                raise ValueError("존재하지 않거나 유효하지 않은 음력 날짜입니다.")

        try:
            result = interpret_birth(
                year=year,
                month=month,
                day=day,
                hour=hour,
                minute=minute,
                mode="combined",
                api_key=MY_KEY,
                stream=True
            )
        except ImportError:
            print("\n[시스템 경고] sajupy 모듈이 설치되지 않아 샘플 데이터로 테스트를 진행합니다.\n")
            sample_saju = ['庚', '午', '丙', '戌', '戊', '申', '己', '未']
            result = interpret_saju(
                eight_chars=sample_saju,
                mode="combined",
                api_key=MY_KEY,
                stream=True
            )

        # 결과 출력 (스트리밍)
        for token in result['stream']:
            print(token, end="", flush=True)
        print()

    except ValueError as ve:
        print(f"입력 오류: {ve}")
    except Exception as e:
        print(f"실행 중 오류가 발생했습니다: {e}")