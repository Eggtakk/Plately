# Plately — UI 설계 문서

- 작성일: 2026-08-27
- 프로젝트: 2026 한국관광 데이터랩 활용 경진대회 출품 서비스
- 범위: 프런트엔드 UI (목데이터 기반, 백엔드/데이터 파이프라인은 이후 단계)
- 상태: 승인됨 (2026-08-27)

## 1. 한 줄 정의

**Plately** — 방한 무슬림·힌두 등 종교/식이 제약이 있는 여행자를 위한 "포크프리·비프프리 한식/음식점 탐색 서비스"이자, 동시에 전국 229개 시군구의 무슬림 친화 식당 **수요–공급 갭**을 진단하는 정책용 대시보드.

관련 배경 문서 (Notion):

- 서비스 방향 정리 — https://app.notion.com/p/3c9046ef12cb814d8f38d22fd641879f
- 구현 파이프라인 & 필요 데이터·툴 — https://app.notion.com/p/3c9046ef12cb8127b055caa24d74c185
- 3~4일 MVP 구현 일정 — https://app.notion.com/p/3c9046ef12cb813c9adfc6fc5ec7c654
- 기존 서비스 & 개선 방향 — https://app.notion.com/p/3c4046ef12cb8011a6bfe7d38bd0ab7b

## 2. 제품 구조 — 두 개의 모드

Next.js 앱 하나 안에서 상단 스위치로 두 모드를 전환한다. 모드는 라우팅으로만 구분하며, 두 모드가 공유하는 상태는 **언어**와 **테마**뿐이다.

| 모드 | 대상 사용자 | 목적 |
| --- | --- | --- |
| **Explore** (기본) | 무슬림 / 힌두 / 기타 여행자 | 온보딩 → 지도 + 리스트로 포크프리·비프프리 음식점 탐색 → 식당 상세 |
| **Insight** | 대회 심사위원 / 정책 담당 | 229개 시군구 수요–공급 갭 지수 지도, 랭킹, 서울/부산/공백지역 3개 지역 대조 서사 |

이유: 다국어(특히 아랍어·힌디어)가 가장 중요한 쪽은 여행자용 B2C 화면이고, 대회 심사에서 차별점이 되는 쪽은 갭 진단 도구다. 한 제품에서 둘 다 보여줘야 "앱 하나 더"가 아니라 "공백을 진단하고 후보를 공급하는 서비스"라는 포지셔닝이 성립한다.

## 3. 다국어(i18n) & RTL

### 3.1 로케일

- 지원 로케일: `en` · `ko` · `ar` · `hi`
- 라우팅: `app/[locale]/…` 구조. 로케일이 URL의 단일 진실 소스(single source of truth).
- 미들웨어가 `Accept-Language` 헤더로 최적 로케일을 판별해 리다이렉트하고, 사용자가 명시적으로 고른 로케일은 쿠키에 저장한다.
- 언어 선택기는 각 언어를 자기 언어 이름으로 표기: `English` / `한국어` / `العربية` / `हिन्दी`.

### 3.2 RTL

- `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`.
- **모든 레이아웃은 CSS 논리 속성(logical properties)으로 작성**한다: `margin-inline`, `padding-inline`, `inset-inline-start/end`, `border-start-*`, `text-align: start` 등. 물리 속성(`left`, `right`, `margin-left`)은 금지.
- 그 결과 온보딩, 지도+리스트 스플릿, 카드 레이아웃, 하단 탭 내비게이션이 아랍어에서 자동으로 좌우 반전된다.
- 아이콘 중 방향성이 있는 것(뒤로가기, 화살표)은 `[dir="rtl"]`에서 `scale-x(-1)` 처리.
- MapLibre 컨트롤(줌 버튼 등)의 위치도 `dir`에 맞춰 inline-start/end로 배치.

### 3.3 포맷팅 & 폰트

- `next-intl` 사용: 메시지 카탈로그 + 로케일별 숫자/날짜 포맷.
- **갭 지수 수치는 로케일와 무관하게 라틴 숫자(`latn`)로 고정** — 화면·발표에서 비교 가능성을 유지하기 위함. 그 외 건수(식당 수 등)는 `Intl.NumberFormat(locale)` 기본값을 따른다.
- 폰트: `next/font/google` 로 Noto Sans / Noto Sans KR / Noto Sans Arabic / Noto Sans Devanagari 로드. `font-family` 는 로케일에 따라 스택 우선순위를 바꾼다.

### 3.4 번역 커버리지 정책

- `en` / `ko`: UI 문자열 + 긴 설명 카피까지 전부 작성.
- `ar` / `hi`: UI 문자열은 전부 작성, 긴 마케팅/방법론 카피는 초안 수준. 큐레이션되지 않은 식당명·지역명은 `en` 폴백.
- 메시지 파일: `messages/{locale}.json`. 키 누락 시 `en` 폴백 + 개발 모드 콘솔 경고.

## 4. 비주얼 시스템 — 차분한 자연 톤

디자인 토큰 CSS 변수 + CSS Modules 로 구현한다 (기존 dajim 프로토타입 방식과 동일, CSS 프레임워크 미사용).

### 4.1 색상 토큰 (라이트 / 다크)

| 역할 | 라이트 | 다크 | 용도 |
| --- | --- | --- | --- |
| `--paper` | `#FBF8F3` (따뜻한 오프화이트) | `#16130F` (따뜻한 차콜) | 배경 |
| `--paper-raised` | `#FFFFFF` | `#211D17` | 카드·패널 |
| `--ink` | `#1E1B16` | `#F1ECE1` | 본문 텍스트 |
| `--ink-soft` | `rgba(30,27,22,0.60)` | `rgba(241,236,225,0.62)` | 보조 텍스트 |
| `--primary` | `#1F6E52` (딥 그린) | `#5FBF9B` | CTA, 활성 상태, "공급 있음" |
| `--accent` | `#C56B4A` (클레이) | `#D98A6A` | 보조 액션, "성장·미대응" |
| `--line` | `#E4DCCB` (샌드) | `rgba(241,236,225,0.16)` | 구분선·테두리 |

- 그린은 이슬람권에서 긍정적이고 힌두권·영어권에도 무난하며, 돼지/술 연상 이미지가 없다. 강한 레드는 피한다.
- 다크 모드는 순수 검정이 아니라 따뜻한 차콜로 눈부심을 줄인다.

### 4.2 갭 지수 색상 스케일

- 순차(sequential) 스케일: **낮은 갭 → 높은 갭 = 그린 → 앰버 → 딥 클레이**.
- 라이트·다크 양쪽에서 WCAG AA 대비 확보.
- 색약 사용자를 위해 색 외의 구분 수단 병행: 지도에서는 hover/선택 시 수치 라벨 노출, 랭킹 표에는 수치와 순위가 항상 텍스트로 표기. 범례에 패턴 대안 표기.

### 4.3 기타 규칙

- 모서리 반경 12~16px, 부드러운 그림자, 넉넉한 여백.
- 지수·수치에는 `font-variant-numeric: tabular-nums`.
- 돼지고기·술 이미지 사용 금지. 아이콘 언어는 접시, 지도 핀, 체크마크 중심.
- `prefers-color-scheme`, `prefers-reduced-motion` 존중 + 수동 테마 토글(`data-theme` 오버라이드).
- 모든 인터랙티브 요소에 `:focus-visible` 링. 대비 AA 이상.

## 5. 화면 정의

### 5.1 공통 크롬

- 상단 바: Plately 워드마크 · Explore/Insight 모드 스위치 · 언어 선택기(지구본, 자기 언어명 표기) · 테마 토글.
- 모바일 Explore 모드: 하단 탭 내비게이션(탐색 / 온보딩 재설정 / 정보).

### 5.2 Explore 모드

**① 온보딩 — `/[locale]/start`**

- 2단계, 건너뛰기 가능.
- 1단계 "무엇을 피하시나요?": 큼직한 탭 카드 4종
  - **Muslim** — 돼지고기 제외(고정) + 토글 "매장 내 음주도 피하기"
  - **Hindu** — 소고기 제외(고정) + 토글 "채식만 보기"
  - **그냥 포크프리만**
  - **직접 설정** — 개별 속성 토글(돼지/술/소/채식)
- 2단계: 도시 선택(서울·부산·제주·인천 … + "내 주변").
- 결과는 `localStorage`(`plately.prefs`)에 저장. 서버 불필요.

**② 탐색 — `/[locale]/explore`**

- MapLibre 지도 + 스크롤 결과 리스트의 스플릿 뷰. 데스크톱은 좌우(논리적으로 inline), 모바일은 상하 스택 + 시트 토글.
- 필터 칩(온보딩 프리퍼런스로 초기값 세팅): Pork-free / Alcohol-free / Vegetarian / Beef-free / Seafood / Chicken / Korean cuisine / Halal-certified.
- 지도 핀: 신뢰도별 색/아이콘 구분.
- 리스트 카드: 이름, 요리 종류, 지역, 거리, **신뢰도 배지**(전화 검증 완료 / 메뉴 확인 / 상호명 추론), 태그.
- 정렬: 거리순 / 신뢰도순.

**③ 식당 상세 — `/[locale]/explore/[id]`**

- 히어로 영역(사진 의존 없이 톤 기반 스타일).
- 주소 + 미니 지도.
- "이 식당이 목록에 오른 이유": 매칭된 상호명 토큰, TourAPI 메뉴 텍스트 확인 여부, 전화 검증 날짜.
- 속성 체크리스트: 돼지 포함 ✗ / 술 판매 ✗ 또는 ? / 소 포함 ✓ / 채식 옵션 ✓.
- 대표메뉴(TourAPI `대표메뉴`·`취급메뉴` 필드).
- 액션: 길찾기, 전화, 주소 복사.
- 면책 문구: 최종 확인은 이용자 책임, 육수·조미료의 돼지 성분은 상호명만으로 안 잡힐 수 있음.

### 5.3 Insight 모드

**④ 갭 지도 — `/[locale]/insight`**

- 229개 시군구 코로플레스(choropleth) 지도. MapLibre + `public/`에 번들된 간략화 GeoJSON.
- 지역 클릭 → 사이드 패널: 수요(무슬림/외국인 방문자 비중), 공급(검증된 포크프리 식당 수), 갭 지수, 상위 후보 식당, 처리 상태.
- 레이어 토글: 갭 지수 / 수요 / 공급 / 후보 밀도.
- **지도의 접근성 대안**: 같은 데이터를 정렬된 지역 리스트로도 제공(키보드 내비게이션 가능).

**⑤ 랭킹 — `/[locale]/insight/rankings`**

- 시군구 정렬 가능 표: 갭 지수, 수요 순위, 공급 건수, 2019년 대비 추세.
- 광역시도별 필터.

**⑥ 3개 지역 대조 — `/[locale]/insight/compare`**

- 심사·발표용 서사 화면. 3열 구성:
  - **서울(용산·마포)** — "포화", 대조군 기준선
  - **부산** — "성장·미대응"(무슬림 방문 증가 + 돼지 중심 식문화 + 해산물 대안)
  - **데이터로 결정된 공백지역** — "인프라 0"
- 각 열: 미니 스탯 블록 + 막대 비교 + 한 줄 처방.
- 발표 서사: "같은 나라에서 세 가지 다른 처방이 필요하다."

**⑦ 정보 / 데이터 & 방법론 — `/[locale]/insight/about`**

- 데이터 출처(LOCALDATA, TourAPI, 한국관광 데이터랩), 파이프라인 다이어그램, 공공누리 공개 계획, 방법론, 한계.
- 대부분 정적 + 번역.

## 6. 데이터 계층

### 6.1 `lib/mockData.ts` — 타입 정의 + 접근자

향후 API를 그대로 흉내 내는 접근자 함수:

```ts
getRestaurants(filter): Restaurant[]
getRestaurant(id): Restaurant
getRegions(): RegionGap[]              // 229개
getRegion(code): RegionGapDetail
getComparisonRegions(): [Region, Region, Region]
```

### 6.2 타입

```ts
type LocalizedName = { en: string; ko: string; ar?: string; hi?: string };

interface Restaurant {
  id: string;
  name: LocalizedName;
  area: LocalizedName;
  sigunguCode: string;
  coords: [number, number];            // [lng, lat]
  cuisine: string;
  attributes: {
    containsPork: boolean;
    servesAlcohol: boolean | 'unknown';
    containsBeef: boolean;
    vegetarianFriendly: boolean;
  };
  confidence: 'phone' | 'menu' | 'name';
  matchedTokens: string[];
  repMenu: string[];
}

interface RegionGap {
  code: string;
  name: LocalizedName;
  gwangyeok: string;
  demandScore: number;                  // 방문자 수요 지표
  supplyCount: number;                   // 검증된 포크프리 식당 수
  gapIndex: number;                      // 0~100
  trendVs2019: number;                   // % 변화
}
```

### 6.3 필터 로직 — `lib/filter.ts`

Notion "사용자단 필터링 로직"을 그대로 구현:

```
IF 종교 == "무슬림":
    후보 = WHERE containsPork == false
    IF 음주 허용 == false:
        후보 = 후보 WHERE servesAlcohol == false   // 'unknown'은 별도 표기 후 포함/제외 선택 가능
IF 종교 == "힌두교":
    후보 = WHERE containsBeef == false
    IF 채식만 == true:
        후보 = 후보 WHERE vegetarianFriendly == true
```

이 파일이 **실데이터 교체의 유일한 이음새(seam)**다. 나중에 LOCALDATA·TourAPI·데이터랩 데이터가 접근자 함수 뒤로 들어오면 화면 코드는 바뀌지 않는다.

### 6.4 지도

- **OpenFreeMap**(키 불필요) 벡터 타일 + 팔레트에 맞춘 차분한 커스텀 스타일.
- `public/sigungu.simplified.geojson` — 약 229개 피처, 간략화하여 약 500KB 이하 유지.
- 지도 렌더는 `maplibre-gl`(필요 시 `react-map-gl` 래퍼).

## 7. 상태 · 지속성

- 프리퍼런스: `usePreferences` 훅(SSR 안전, 하이드레이션 가드) → `localStorage`.
- 언어: 쿠키 + URL.
- 모드: 라우팅.
- v1에는 인증·백엔드 없음.

## 8. 접근성 & RTL 세부

- 레이아웃 전부 논리 속성 + flex/grid.
- 아랍어 `dir=rtl` 수동 점검 대상: 온보딩, 스플릿 뷰, 하단 탭, 지도 컨트롤, 카드 그리드.
- 코로플레스 지도는 정렬된 지역 리스트 대안을 항상 함께 제공(키보드/스크린리더).
- 색약 대응: §4.2 참조.
- 모든 라우트 AA 대비, `:focus-visible` 링.

## 9. 테스트 전략

- **Vitest + Testing Library**: `usePreferences` 훅, `lib/filter.ts` 필터 로직, 갭 색상 스케일 함수, 로케일 폴백, `dir=rtl` 속성 세팅.
- **Playwright 스모크**:
  - 모든 라우트가 4개 로케일에서 콘솔 에러 없이 렌더
  - `ar`에서 `dir=rtl` 설정 확인
  - 온보딩 선택이 새로고침 후 유지
  - 필터 적용 시 리스트가 좁혀짐
  - 갭 지도 지역 클릭 시 사이드 패널 오픈
- (선택) CI에 axe 접근성 체크.

## 10. 기술 스택

- Next.js 16 App Router, React 19, TypeScript
- `next-intl` (i18n)
- `maplibre-gl` (+ 필요 시 `react-map-gl`), OpenFreeMap 키리스 벡터 타일
- 스타일: 디자인 토큰 CSS 변수 + CSS Modules (CSS 프레임워크 미사용)
- 테스트: Vitest, @testing-library/react, Playwright

## 11. 디렉터리 구조

레포 루트에 `dajim/`와 나란히 `plately/` 신설:

```
plately/
  README.md
  docs/
    superpowers/specs/2026-08-27-plately-ui-design.md   ← 이 문서
  plately-web/                                          ← Next.js 앱
    app/[locale]/…
    components/
    lib/mockData.ts
    lib/filter.ts
    messages/{en,ko,ar,hi}.json
    public/sigungu.simplified.geojson
```

Python 데이터 파이프라인은 이후 단계에서 `plately/` 아래에 추가(dajim 구조와 동일).

## 12. 명시적 비범위 (v1에서 하지 않는 것)

- 실제 LOCALDATA / TourAPI / 데이터랩 연동 — 목데이터로 대체, 이음새만 마련
- 전화 검증 워크플로 UI
- 사용자 계정 / 로그인 / 리뷰 작성
- 실제 갭 지수 산출 알고리즘 — 화면은 계산된 값을 표시만
- 배포 파이프라인 / 공공누리 정식 등록
- 유대교 코셔 등 3번째 종교 축(구조는 확장 가능하게 두되 UI에는 미노출)
