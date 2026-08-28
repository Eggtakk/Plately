"""Notion 3단계 — TourAPI 메뉴 텍스트 대조. 상호명에서 놓친 돈육/주류를
메뉴 텍스트로 잡고, repMenu 를 채운다.

fixture 디렉터리: contentid.json 파일들. 각 파일은
{title, firstmenu, treatmenu} (TourAPI detailIntro 응답 서브셋).
매칭: title 정확 일치 (실데이터는 상호명+좌표 근접까지 필요하지만 샘플 규모라 title).

TODO(real-data): 실데이터는 상호명 정규화 + 좌표 근접 매칭이 필요하다 (exact-title
불가), 메뉴 구분자도 `, / \\n` 외에 `· | () ;` 등을 다뤄야 한다.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from pipeline import tokens
from pipeline.schema import TOURAPI_TITLE, TOURAPI_FIRSTMENU, TOURAPI_TREATMENU


def _load_fixtures(fixture_dir) -> dict[str, dict]:
    path = Path(fixture_dir)
    if not path.is_dir():
        return {}
    out: dict[str, dict] = {}
    for p in sorted(path.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        out[str(data.get(TOURAPI_TITLE, "")).strip()] = data
    return out


def _split_menu(text: str) -> list[str]:
    parts = []
    for chunk in str(text).replace("\n", ",").replace("/", ",").split(","):
        c = chunk.strip()
        if c:
            parts.append(c)
    return parts


def _menu_parts(fx: dict) -> list[str]:
    return _split_menu(fx.get(TOURAPI_FIRSTMENU, "")) + _split_menu(fx.get(TOURAPI_TREATMENU, ""))


def crosscheck_menus(candidates: pd.DataFrame, fixture_dir) -> pd.DataFrame:
    fixtures = _load_fixtures(fixture_dir)
    rows = []
    for _, r in candidates.iterrows():
        row = r.to_dict()
        fx = fixtures.get(str(row["name"]).strip())
        if fx:
            parts = _menu_parts(fx)
            joined = " ".join(parts)
            if any(tok in joined for tok in tokens.MENU_EXCLUDE_PORK):
                row["containsPork"] = True
            if any(tok in joined for tok in tokens.ALCOHOL_MENU):
                row["servesAlcohol"] = True
            row["repMenu"] = _split_menu(fx.get(TOURAPI_FIRSTMENU, ""))
            row["confidence"] = "menu"
        rows.append(row)

    if not rows:
        return candidates.iloc[0:0].reset_index(drop=True)

    out = pd.DataFrame(rows)
    out = out.astype({c: object for c in out.columns if c not in ("lng", "lat")})
    out = out[out["containsPork"] != True]  # noqa: E712  메뉴에서 돈육 확인된 후보 탈락
    return out.reset_index(drop=True)
