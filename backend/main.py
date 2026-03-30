import sys
import os
from pathlib import Path

# test.py가 상위 디렉토리에 있으므로 경로 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional
import asyncio

from test import interpret_birth, interpret_saju, get_eight_chars_from_sajupy

# 음력 변환 (선택적)
try:
    from korean_lunar_calendar import KoreanLunarCalendar
except ImportError:
    KoreanLunarCalendar = None

app = FastAPI(title="사주-MBTI 분석 API", version="1.0.0")

# CORS 설정 (로컬 개발 + 프로덕션 모두 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 프론트엔드 정적 파일 서빙
frontend_dir = Path(__file__).parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")


# ─────────────────────────────────────────
# 요청 스키마
# ─────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    year: int = Field(..., ge=1900, le=2100, description="연도")
    month: int = Field(..., ge=1, le=12, description="월")
    day: int = Field(..., ge=1, le=31, description="일")
    hour: int = Field(..., ge=0, le=23, description="시 (0~23)")
    minute: int = Field(default=0, ge=0, le=59, description="분")
    gender: str = Field(default="M", pattern="^[MF]$", description="성별 (M/F)")
    is_lunar: bool = Field(default=False, description="음력 여부")
    is_leap_month: bool = Field(default=False, description="윤달 여부")
    mode: str = Field(default="combined", pattern="^(saju|mbti|combined)$", description="분석 모드")


# ─────────────────────────────────────────
# 엔드포인트
# ─────────────────────────────────────────

@app.get("/")
async def root():
    index_path = frontend_dir / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "사주-MBTI API 서버 동작 중", "docs": "/docs"}


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    year, month, day = req.year, req.month, req.day

    # 음력 → 양력 변환
    if req.is_lunar:
        if KoreanLunarCalendar is None:
            raise HTTPException(
                status_code=400,
                detail="음력 변환 라이브러리가 설치되어 있지 않습니다. pip install korean_lunar_calendar"
            )
        cal = KoreanLunarCalendar()
        cal.setLunarDate(year, month, day, req.is_leap_month)
        if not cal.isValid():
            raise HTTPException(status_code=400, detail="유효하지 않은 음력 날짜입니다.")
        year, month, day = cal.solarYear, cal.solarMonth, cal.solarDay

    # 사주 계산 + GPT 해석 (동기 함수를 스레드풀에서 실행)
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: interpret_birth(
                year=year,
                month=month,
                day=day,
                hour=req.hour,
                minute=req.minute,
                mode=req.mode,
                stream=False,
            )
        )
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"모듈 오류: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 중 오류: {str(e)}")

    # Firestore 저장에 필요한 직렬화 가능한 형태로 변환
    return {
        "success": True,
        "solar_date": {"year": year, "month": month, "day": day},
        "mbti": result["mbti"],
        "pillars": result["computed"]["사주_원국"],
        "day_master": result["computed"]["일간"],
        "five_elements": result["computed"]["오행_기본분포"],
        "five_elements_status": result["computed"]["오행_분석"],
        "interpretation": result.get("interpretation", ""),
        "llm_payload": result["llm_payload"],
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}
