"""행안부 일반음식점 open API(data.go.kr 15154916) 클라이언트.
이번 세션 미실행 — DATA_GO_KR_API_KEY 발급 + endpoint 검증 후 실데이터 단계에서.

endpoint / param 이름 / 응답 필드는 best-effort (localdata.go.kr·행안부 규약 기준 추정).
첫 실행 시: 응답 1페이지를 raw 로 저장 → 실제 키/필드 확인 → 이 파일 + schema.LOCALDATA_API_FIELD_MAP 수정.

이 API 는 페이지당 100건 고정, 전국 약 229만행 = 22,934콜 ≈ 14시간.
개발계정 일 10,000콜 제한 → --max-pages 로 나눠 받고 --start-page 로 이어받기.
CSV 로 증분 저장(페이지마다 flush) — 중단해도 받은 만큼 남음.

  # 1일차: 처음 9000페이지 (90만행)
  python -m scripts.fetch_localdata --out data/raw/localdata.csv --max-pages 9000
  # 2일차: 이어서
  python -m scripts.fetch_localdata --out data/raw/localdata.csv --start-page 9001 --max-pages 9000
  # 3일차: 나머지
  python -m scripts.fetch_localdata --out data/raw/localdata.csv --start-page 18001

  → run_pipeline --localdata-format api --localdata data/raw/localdata.csv

** 전국 벌크는 localdata.go.kr "지방행정인허가데이터개방 → 일반음식점 → 전체자료"
   CSV 다운로드가 더 빠름(키·호출 불필요). 그 CSV 도 --localdata 로 그대로 넣으면 됨. **
"""
from __future__ import annotations

import argparse
import os
import time
from pathlib import Path
from urllib.parse import unquote

import pandas as pd
import requests
from dotenv import load_dotenv

from pipeline import schema

# 행안부 15154916 "식품_일반음식점 조회서비스" (미리보기 URL 로 확인, 2026-08).
# 요청주소가 오퍼레이션 경로 없이 한 조각이면 LIST_OP = "" 로 두면 BASE 로 직접 호출.
BASE = "https://apis.data.go.kr/1741000/general_restaurants"
LIST_OP = "info"

# 시도 2자리 코드(우리 파이프라인 kostat-2018 접두와 동일 체계는 아님 — LOCALDATA localCode 앞자리).
# 검증 필요. 전국 수집이 기본이므로 이 맵은 선택적 청크용.


def build_params(api_key: str, page_no: int, num_rows: int, *, local_code: str | None = None) -> dict:
    p = {
        "serviceKey": api_key,
        "pageNo": page_no,
        "numOfRows": num_rows,
        "returnType": "json",
    }
    if local_code:
        p["localCode"] = local_code
    return p


def _rows(body: dict) -> list[dict]:
    # 표준 data.go.kr 응답: response.body.items.item[] — 혹은 LOCALDATA 자체 규약 result.row[]
    b = body.get("response", {}).get("body", {})
    if not isinstance(b, dict):
        b = {}
    items = b.get("items")
    if isinstance(items, dict):
        item = items.get("item", [])
        if not item:
            return []
        return item if isinstance(item, list) else [item]
    if isinstance(items, list):
        return items
    # LOCALDATA-style fallback
    result = body.get("result") or body.get("LOCALDATA_072404") or {}
    rows = result.get("row") if isinstance(result, dict) else None
    return rows if isinstance(rows, list) else []


def parse_rows(body: dict) -> list[dict]:
    """API 응답 → [{schema 표준 컬럼명: 값}]. 매핑된 8개 컬럼을 항상 포함(없으면 "") —
    증분 CSV append 시 스키마가 일정하도록."""
    out = []
    for r in _rows(body):
        if not isinstance(r, dict):
            continue
        rec = {std_col: (r.get(api_field) or "")
               for api_field, std_col in schema.LOCALDATA_API_FIELD_MAP.items()}
        if rec.get(schema.NAME_COL):  # 최소 상호명은 있어야 유효
            out.append(rec)
    return out


def total_count(body: dict) -> int | None:
    b = body.get("response", {}).get("body", {})
    if not isinstance(b, dict):
        return None
    for k in ("totalCount", "total_count"):
        if k in b:
            try:
                return int(b[k])
            except (TypeError, ValueError):
                return None
    return None


PAGE_SIZE = 100  # 이 API 는 numOfRows 무시하고 페이지당 100건 고정 (2026-08 확인)


def _get_page(session: requests.Session, url: str, api_key: str, page: int,
              local_code: str | None, retries: int = 4) -> dict:
    for attempt in range(retries):
        try:
            r = session.get(url, params=build_params(api_key, page, PAGE_SIZE, local_code=local_code),
                            timeout=20)
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError) as e:
            if attempt == retries - 1:
                raise
            wait = 2 ** attempt
            print(f"  ! page {page} 재시도 {attempt + 1}/{retries} ({e}) — {wait}s 대기", flush=True)
            time.sleep(wait)
    return {}


def fetch_all(api_key: str, *, local_code: str | None = None, sleep: float = 0.2,
              start_page: int = 1, max_pages: int | None = None,
              session: requests.Session | None = None,
              on_batch=None) -> int:
    """페이지네이션. on_batch(rows, page, total_pages) 를 페이지마다 호출(있으면).
    반환: 받은 총 행 수. all-in-memory 아님 — 소비는 on_batch 가."""
    s = session or requests.Session()
    url = f"{BASE}/{LIST_OP}" if LIST_OP else BASE
    got, page, total_pages = 0, start_page, None
    while max_pages is None or page < start_page + max_pages:
        body = _get_page(s, url, api_key, page, local_code)
        rows = parse_rows(body)
        if total_pages is None:
            tc = total_count(body)
            total_pages = (tc + PAGE_SIZE - 1) // PAGE_SIZE if tc else None
        got += len(rows)
        if on_batch:
            on_batch(rows, page, total_pages)
        if not rows or (total_pages is not None and page >= total_pages):
            break
        page += 1
        time.sleep(sleep)
    return got


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="행안부 일반음식점 API(15154916) → CSV (증분 저장, 이어받기)")
    ap.add_argument("--out", type=Path, default=Path("data/raw/localdata.csv"))
    ap.add_argument("--sido", type=str, default=None, help="localCode 앞자리 등 지역 필터 (선택, 명세 확인)")
    ap.add_argument("--start-page", type=int, default=1, help="이어받기: 마지막으로 받은 페이지+1")
    ap.add_argument("--max-pages", type=int, default=None,
                    help="이번 실행에서 받을 최대 페이지 수 (일 10,000콜 제한 대응 — 예: 9000)")
    ap.add_argument("--sleep", type=float, default=0.2)
    a = ap.parse_args()

    api_key = os.environ.get("DATA_GO_KR_API_KEY")
    if not api_key:
        raise SystemExit("DATA_GO_KR_API_KEY 미설정 — .env 를 채우세요")
    api_key = unquote(api_key)  # data.go.kr "Encoding" 키 대응

    out = a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    append = a.start_page > 1 and out.exists()
    fh = out.open("a" if append else "w", newline="", encoding="utf-8-sig")
    writer = {"w": None, "n": 0}
    t0 = time.time()

    def on_batch(rows, page, total_pages):
        if rows and writer["w"] is None:
            import csv
            writer["w"] = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            if not append:
                writer["w"].writeheader()
        for row in rows:
            writer["w"].writerow(row)
        writer["n"] += len(rows)
        fh.flush()
        if page % 50 == 0 or (total_pages and page >= total_pages):
            elapsed = time.time() - t0
            done = page - a.start_page + 1
            rate = done / elapsed if elapsed else 0
            eta = ((total_pages - page) / rate) if (total_pages and rate) else None
            eta_s = f" · ETA {eta / 3600:.1f}h" if eta else ""
            tp = f"/{total_pages}" if total_pages else ""
            print(f"  page {page}{tp} · {writer['n']:,} rows{eta_s}", flush=True)

    try:
        got = fetch_all(api_key, local_code=a.sido, sleep=a.sleep,
                        start_page=a.start_page, max_pages=a.max_pages, on_batch=on_batch)
    finally:
        fh.close()

    if writer["n"] == 0:
        raise SystemExit("0 rows — endpoint/param/field 검증 필요 (스크립트 상단 주석)")
    print(f"\n{writer['n']:,} rows ({got} fetched) → {out}")
    if a.max_pages:
        print(f"이어받기: --start-page {a.start_page + a.max_pages} 로 다음 실행")


if __name__ == "__main__":
    main()
