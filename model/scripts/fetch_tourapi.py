"""TourAPI(한국관광공사 국문 관광정보 서비스) 로 음식점 대표/취급 메뉴 수집.
이번 세션 미실행 — DATA_GO_KR_API_KEY 발급(공공데이터포털) 후 실데이터 단계에서 사용.

흐름: 후보 상호명 → searchKeyword2 로 contentId + 좌표 해석 → detailIntro2 로
firstmenu(대표메뉴)/treatmenu(취급메뉴) 수집 → data/raw/tourapi/<contentId>.json.
그 디렉터리를 run_pipeline 의 --tourapi-dir 로 넘기면 crosscheck_menus 가 소비.

사용:
  python -m scripts.fetch_tourapi --candidates out/restaurants.json --out data/raw/tourapi
  # .env 의 DATA_GO_KR_API_KEY 는 Decoding/Encoding 키 아무거나 가능
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from urllib.parse import unquote

import requests
from dotenv import load_dotenv

BASE = "https://apis.data.go.kr/B551011/KorService2"
DETAIL_INTRO = f"{BASE}/detailIntro2"
SEARCH_KEYWORD = f"{BASE}/searchKeyword2"

_COMMON = {"MobileOS": "ETC", "MobileApp": "Plately", "_type": "json", "contentTypeId": "39"}


def build_intro_params(api_key: str, content_id: str) -> dict:
    return {**_COMMON, "serviceKey": api_key, "contentId": content_id}


def build_search_params(api_key: str, keyword: str) -> dict:
    return {**_COMMON, "serviceKey": api_key, "keyword": keyword, "numOfRows": 5, "pageNo": 1}


def _items(body: dict) -> list[dict]:
    items = body.get("response", {}).get("body", {}).get("items")
    if not items or items == "":
        return []
    item = items.get("item", [])
    if not item:
        return []
    return item if isinstance(item, list) else [item]


def parse_search_first(body: dict) -> dict | None:
    for it in _items(body):
        cid = str(it.get("contentid", "")).strip()
        if cid:
            return {"contentid": cid, "mapx": str(it.get("mapx", "")), "mapy": str(it.get("mapy", ""))}
    return None


def parse_detail_intro(body: dict, title: str) -> dict | None:
    for it in _items(body):
        return {
            "contentid": str(it.get("contentid", "")),
            "title": it.get("title", title) or title,
            "firstmenu": it.get("firstmenu", "") or "",
            "treatmenu": it.get("treatmenu", "") or "",
        }
    return None


def resolve_content(api_key: str, keyword: str, session: requests.Session) -> dict | None:
    r = session.get(SEARCH_KEYWORD, params=build_search_params(api_key, keyword), timeout=10)
    r.raise_for_status()
    return parse_search_first(r.json())


def fetch_intro(api_key: str, content_id: str, title: str, session: requests.Session) -> dict | None:
    r = session.get(DETAIL_INTRO, params=build_intro_params(api_key, content_id), timeout=10)
    r.raise_for_status()
    return parse_detail_intro(r.json(), title)


def _candidate_name(c: dict) -> str:
    name = c.get("name")
    if isinstance(name, dict):
        return name.get("ko") or name.get("en") or ""
    return str(name or "")


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", type=Path, required=True,
                    help="restaurants.json (name / 선택적 contentId) 배열")
    ap.add_argument("--out", type=Path, default=Path("data/raw/tourapi"))
    ap.add_argument("--sleep", type=float, default=0.2)
    a = ap.parse_args()

    api_key = os.environ.get("DATA_GO_KR_API_KEY")
    if not api_key:
        raise SystemExit("DATA_GO_KR_API_KEY 미설정 — .env 를 채우세요")
    api_key = unquote(api_key)  # data.go.kr "Encoding" 키를 붙여넣어도 동작하도록

    cands = json.loads(a.candidates.read_text(encoding="utf-8"))
    a.out.mkdir(parents=True, exist_ok=True)
    written = 0
    failed = 0
    with requests.Session() as s:
        for c in cands:
            name = _candidate_name(c)
            try:
                cid = c.get("contentId") or c.get("contentid")
                hit = None
                if not cid:
                    if not name:
                        continue
                    hit = resolve_content(api_key, name, s)
                    time.sleep(a.sleep)
                    cid = hit["contentid"] if hit else None
                if not cid:
                    continue
                rec = fetch_intro(api_key, str(cid), name, s)
                time.sleep(a.sleep)
                if rec and (rec["firstmenu"] or rec["treatmenu"]):
                    if hit and hit.get("mapx"):
                        rec = {**rec, "mapx": hit["mapx"], "mapy": hit["mapy"]}
                    (a.out / f"{cid}.json").write_text(
                        json.dumps(rec, ensure_ascii=False), encoding="utf-8")
                    written += 1
            except requests.RequestException as e:
                failed += 1
                print(f"  skip {name!r}: {e}")
    print(f"wrote {written} menu fixtures ({failed} failed) → {a.out}")


if __name__ == "__main__":
    main()
