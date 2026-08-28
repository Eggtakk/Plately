"""Notion 1단계 — 정형 데이터 필터. 영업중 + 비주류 음식점만 남긴다."""
from __future__ import annotations

import re

import pandas as pd

from pipeline import schema

_ALCOHOL_RE = "|".join(re.escape(t) for t in schema.ALCOHOL_BUSINESS_TYPES)


def filter_localdata(df: pd.DataFrame) -> pd.DataFrame:
    """LOCALDATA(또는 샘플) DataFrame → 정규화된 후보 DataFrame.

    출력 컬럼: name, sigungu_code, lng, lat, biztype
    """
    out = df

    out = out[out[schema.STATUS_COL] == schema.OPEN_STATUS_NAME]
    out = out[~out[schema.DETAIL_STATUS_COL].isin(schema.CLOSED_DETAIL_STATUSES)]
    # substring — 실 LOCALDATA 업태는 "호프/통닭", "정종/대포집/소주방" 같은 복합값
    out = out[~out[schema.BIZTYPE_COL].astype(str).str.contains(_ALCOHOL_RE, regex=True, na=False)]

    lng = pd.to_numeric(out[schema.LNG_COL], errors="coerce")
    lat = pd.to_numeric(out[schema.LAT_COL], errors="coerce")
    min_lng, min_lat, max_lng, max_lat = schema.KOREA_BBOX
    out = out[lng.between(min_lng, max_lng) & lat.between(min_lat, max_lat)]

    result = pd.DataFrame(
        {
            "name": out[schema.NAME_COL].astype(str).str.strip(),
            "sigungu_code": out[schema.SIGUNGU_CODE_COL].astype(str).str.strip(),
            "lng": out[schema.LNG_COL].astype(float),
            "lat": out[schema.LAT_COL].astype(float),
            "biztype": out[schema.BIZTYPE_COL].astype(str).str.strip(),
        }
    ).reset_index(drop=True)
    return result
