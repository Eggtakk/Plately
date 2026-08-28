"""LOCALDATA / TourAPI 입력 계약. 실제 헤더를 확인하기 전까지는
표준 용어 기반 추정이며, 컬럼명이 다르면 여기만 고치면 된다.

LOCALDATA "일반음식점"/"휴게음식점" CSV 헤더 기준(지방행정인허가데이터개방):
  사업장명, 영업상태명, 상세영업상태명, 업태구분명,
  소재지전체주소, 도로명전체주소, 좌표정보(x), 좌표정보(y)
좌표계는 EPSG:5174 (TM 중부원점, GRS80).
"""
from __future__ import annotations

# --- LOCALDATA 컬럼명 --------------------------------------------------------
NAME_COL = "사업장명"
STATUS_COL = "영업상태명"
DETAIL_STATUS_COL = "상세영업상태명"
BIZTYPE_COL = "업태구분명"
ADDR_COL = "소재지전체주소"
ROAD_ADDR_COL = "도로명전체주소"
X_COL = "좌표정보(x)"
Y_COL = "좌표정보(y)"
# 샘플 CSV는 아래 두 컬럼을 직접 제공(실데이터엔 없음 → 주소 파싱으로 대체)
SIGUNGU_CODE_COL = "sigungu_code"
LNG_COL = "lng"
LAT_COL = "lat"

# LOCALDATA open API(행안부 15154916 / localdata.go.kr) 응답 필드 → 우리 표준 컬럼.
# best-effort — 실제 응답 1페이지로 검증 후 이 맵과 fetch_localdata 를 고칠 것.
LOCALDATA_API_FIELD_MAP = {
    "bplcNm": NAME_COL,
    "trdStateNm": STATUS_COL,
    "dtlStateNm": DETAIL_STATUS_COL,
    "uptaeNm": BIZTYPE_COL,
    "siteWhlAddr": ADDR_COL,
    "rdnWhlAddr": ROAD_ADDR_COL,
    "x": X_COL,
    "y": Y_COL,
}

OPEN_STATUS_NAME = "영업/정상"
CLOSED_DETAIL_STATUSES = frozenset({"폐업", "휴업", "직권말소", "말소", "폐업처리"})

# 주류 전제 업소 → 제외 (Notion 1단계)
ALCOHOL_BUSINESS_TYPES = frozenset(
    {"유흥주점", "단란주점", "감성주점", "소주방", "대포집", "호프", "간이주점", "칵테일바"}
)

# 한반도 대략 bbox (좌표 sanity check)
KOREA_BBOX = (124.0, 33.0, 132.0, 39.5)  # (min_lng, min_lat, max_lng, max_lat)

# --- TourAPI 필드 ----------------------------------------------------------
TOURAPI_TITLE = "title"
TOURAPI_FIRSTMENU = "firstmenu"   # 대표메뉴
TOURAPI_TREATMENU = "treatmenu"   # 취급메뉴
TOURAPI_CONTENTID = "contentid"
TOURAPI_MAPX = "mapx"
TOURAPI_MAPY = "mapy"

# --- 좌표 변환 ------------------------------------------------------------
_TRANSFORMER = None


def _pyproj_available() -> bool:
    try:
        import pyproj  # noqa: F401
        return True
    except ImportError:
        return False


def _transformer():
    global _TRANSFORMER
    if _TRANSFORMER is None:
        from pyproj import Transformer
        _TRANSFORMER = Transformer.from_crs("EPSG:5174", "EPSG:4326", always_xy=True)
    return _TRANSFORMER


def tm_to_wgs84(x: float, y: float) -> tuple[float, float] | None:
    """EPSG:5174 (x, y) → (lng, lat). pyproj 미설치 시 None."""
    if not _pyproj_available():
        return None
    lng, lat = _transformer().transform(x, y)
    return (round(lng, 6), round(lat, 6))
