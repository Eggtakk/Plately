"""행안부 일반음식점 open API(data.go.kr 15154916) 클라이언트.
이번 세션 미실행 — DATA_GO_KR_API_KEY 발급 + endpoint 검증 후 실데이터 단계에서.

endpoint / param 이름 / 응답 필드는 best-effort (localdata.go.kr·행안부 규약 기준 추정).
첫 실행 시: 응답 1페이지를 raw 로 저장 → 실제 키/필드 확인 → 이 파일 + schema.LOCALDATA_API_FIELD_MAP 수정.

parquet 출력에는 pyarrow 가 필요할 수 있음(`pip install pyarrow`). .csv 경로를 주면 CSV 로 저장.

사용:
  python -m scripts.fetch_localdata --out data/raw/localdata.parquet
  # 시도별: --sido 11 (서울) 등, 생략 시 전국
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
    """API 응답 → [{schema 표준 컬럼명: 값}]. LOCALDATA_API_FIELD_MAP 사용, 미지 필드 무시."""
    out = []
    for r in _rows(body):
        if not isinstance(r, dict):
            continue
        rec = {}
        for api_field, std_col in schema.LOCALDATA_API_FIELD_MAP.items():
            if api_field in r:
                rec[std_col] = r[api_field]
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


def fetch_all(api_key: str, *, num_rows: int = 1000, local_code: str | None = None,
              sleep: float = 0.2, session: requests.Session | None = None) -> list[dict]:
    s = session or requests.Session()
    url = f"{BASE}/{LIST_OP}" if LIST_OP else BASE
    page, acc = 1, []
    while True:
        r = s.get(
            url,
            params=build_params(api_key, page, num_rows, local_code=local_code),
            timeout=15,
        )
        r.raise_for_status()
        body = r.json()
        rows = parse_rows(body)
        acc.extend(rows)
        tc = total_count(body)
        if not rows or (tc is not None and len(acc) >= tc):
            break
        page += 1
        time.sleep(sleep)
    return acc


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("data/raw/localdata.parquet"))
    ap.add_argument("--sido", type=str, default=None, help="LOCALDATA localCode 앞자리 (선택)")
    ap.add_argument("--num-rows", type=int, default=1000)
    ap.add_argument("--sleep", type=float, default=0.2)
    a = ap.parse_args()

    api_key = os.environ.get("DATA_GO_KR_API_KEY")
    if not api_key:
        raise SystemExit("DATA_GO_KR_API_KEY 미설정 — .env 를 채우세요")
    api_key = unquote(api_key)  # data.go.kr "Encoding" 키 대응 (fetch_tourapi 와 동일)

    rows = fetch_all(api_key, num_rows=a.num_rows, local_code=a.sido, sleep=a.sleep)
    if not rows:
        raise SystemExit("0 rows — endpoint/param/field 를 명세로 검증하세요 (이 스크립트 상단 주석)")

    df = pd.DataFrame(rows)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    if str(a.out).endswith(".parquet"):
        df.to_parquet(a.out)  # pyarrow 필요 시 `pip install pyarrow`
    else:
        df.to_csv(a.out, index=False, encoding="utf-8-sig")
    print(f"wrote {len(df)} rows → {a.out}")


if __name__ == "__main__":
    main()
