"""실 LOCALDATA(행안부 일반음식점 API 또는 그 CSV) → filter_localdata 입력 형태.
좌표 EPSG:5174 → WGS84, 소재지주소 → 시군구 코드."""
from __future__ import annotations

import sys

import pandas as pd

from pipeline import schema
from pipeline.region_codes import RegionResolver


def normalize(raw: pd.DataFrame, resolver: RegionResolver) -> pd.DataFrame:
    """입력 컬럼: 사업장명, 영업상태명, 상세영업상태명, 업태구분명, 소재지전체주소,
    좌표정보(x), 좌표정보(y)  (schema 상수)
    출력: 위 passthrough + lng, lat, sigungu_code  → filter_localdata 가 그대로 소비.

    벌크 CSV(지번주소 / 좌표정보(X) 등 다른 헤더)는 schema.LOCALDATA_CSV_HEADER_ALIASES
    로 먼저 표준화. 좌표값의 앞뒤 공백은 pd.to_numeric 이 처리.
    """
    df = raw.rename(columns={k: v for k, v in schema.LOCALDATA_CSV_HEADER_ALIASES.items()
                             if k in raw.columns and v not in raw.columns})

    # 폐업 행을 좌표변환·주소해석 전에 제거 (벌크 CSV 는 2.29M 중 ~1.4M 이 폐업).
    # filter_localdata 가 뒤에서 같은 검사를 또 하므로 idempotent.
    if schema.STATUS_COL in df.columns:
        df = df[df[schema.STATUS_COL].astype(str).str.strip() == schema.OPEN_STATUS_NAME]

    # 좌표 EPSG:5174 → WGS84. 벡터화 (Task 3 datalab_adapter 와 동일 방식).
    # NaN in → NaN out, 범위 밖 x/y → inf → filter_localdata 의 bbox 가 제거.
    # pyproj 미설치 시 전부 NaN → 모든 행이 bbox 에서 탈락 (regional 모드 전제이므로
    # 실환경에선 설치돼 있음).
    x = pd.to_numeric(df[schema.X_COL], errors="coerce").to_numpy()
    y = pd.to_numeric(df[schema.Y_COL], errors="coerce").to_numpy()
    if schema._pyproj_available():
        lng_arr, lat_arr = schema._transformer().transform(x, y)
        df[schema.LNG_COL] = pd.Series(lng_arr, index=df.index).round(6)
        df[schema.LAT_COL] = pd.Series(lat_arr, index=df.index).round(6)
    else:
        df[schema.LNG_COL] = float("nan")
        df[schema.LAT_COL] = float("nan")

    df[schema.SIGUNGU_CODE_COL] = df[schema.ADDR_COL].map(
        lambda a: resolver.resolve_from_address(a) or ""
    )
    miss = int((df[schema.SIGUNGU_CODE_COL] == "").sum())
    if miss:
        print(f"  ⚠ 주소→시군구코드 실패 {miss}/{len(df)} (해당 행 제외)", file=sys.stderr)
    df = df[df[schema.SIGUNGU_CODE_COL] != ""]

    keep = [schema.NAME_COL, schema.STATUS_COL, schema.DETAIL_STATUS_COL, schema.BIZTYPE_COL,
            schema.ADDR_COL, schema.LNG_COL, schema.LAT_COL, schema.SIGUNGU_CODE_COL]
    return df[keep].reset_index(drop=True)
