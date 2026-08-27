# Plately — Login + Profile Onboarding (feedback item 1)

- 작성일: 2026-08-27
- 상태: 승인됨 (2026-08-27)
- 전제: `2026-08-27-plately-ui-design.md`의 v1 UI가 `main`에 머지되어 있음. 이 문서는 그 위에 로그인·온보딩 관문을 얹는다.

## 1. 목표

앱 진입을 **로그인 → 언어 선택 → 프로필 만들기 → 상세 프로필** 순의 필수 관문으로 만든다. 세션·프로필이 없으면 어느 경로로 들어와도 이 흐름으로 강제되고, 완료 후 localStorage에 기억되어 다음부터 바로 탐색으로 진입한다. 상세 프로필은 무슬림/힌두 각각의 preference 티어 + 세부 제한 토글로 구성되며, 세부 제한은 실제 식당 필터링에 반영된다.

## 2. 라우트 & 흐름

```
/[locale]/login
  → /[locale]/onboarding/language
  → /[locale]/onboarding/profile
  → /[locale]/onboarding/details
  → /[locale]/explore
```

- **`/login`** — 데모 로그인. 이메일 + 비밀번호 입력란(검증 없음, 비어있지 않으면 통과) + "게스트로 계속" 버튼. `plately.session` 저장 후 `/onboarding/language`로.
- **`/onboarding/language`** — 4개 카드(English / 한국어 / العربية / हिन्दी). 선택 시 해당 로케일로 전환하며 다음 단계로.
- **`/onboarding/profile`** — "프로필 만들기". 카드 2개: ☪️ Muslim / 🕉️ Hindu.
- **`/onboarding/details`** — §4의 상세 화면. 프로필에 따라 내용이 달라짐. "완료" → `onboarded: true` 기록 → `/explore`.
- **`/[locale]/start` 삭제.** 도시 선택 단계는 제거(현재 필터에 사용되지 않음).
- 온보딩 각 단계는 뒤로가기 가능. 언어/프로필 미선택 상태로 다음 단계 진입 시 이전 단계로 되돌림.

## 3. 관문(gate)

`components/onboarding/OnboardingGate.tsx` — 클라이언트 컴포넌트. `app/[locale]/layout.tsx`의 `<body>` 안에서 `{children}`를 감싼다.

- localStorage 하이드레이션 전: 중립 스플래시(로고 + 로딩) 렌더.
- 하이드레이션 후:
  - `/login`, `/onboarding/*` 경로면 게이트 통과(그대로 렌더).
  - 세션 없음 → `router.replace('/login')`.
  - 세션 있음 & `prefs.onboarded !== true` → 미완료 단계로 `router.replace` (프로필 없으면 `/onboarding/profile`, 프로필 있으면 `/onboarding/details`; 언어는 이미 URL 로케일로 결정됨).
  - 세션 있음 & `onboarded === true` → 통과.
- 미들웨어(next-intl)는 로케일만 담당. 세션/프로필은 클라이언트 전용이라 게이트도 클라이언트에서.

## 4. 상세 프로필 화면

### ☪️ Muslim

**Halal preference** (단일 선택 티어):

| key | 라벨(en) |
| --- | --- |
| `halal-certified` | Halal-certified only |
| `halal-meat` | Halal meat required |
| `pork-alcohol-free` | Pork & alcohol free |
| `custom` | Custom |

**Detailed restrictions** (토글): Pork · Alcohol in food · Pork-derived ingredients · Gelatin · Non-halal meat · Seafood · Cross-contamination

### 🕉️ Hindu

**Meat preference** (단일 선택 티어):

| key | 라벨(en) |
| --- | --- |
| `vegetarian` | Vegetarian |
| `no-beef` | No beef |
| `no-beef-pork` | No beef/pork |
| `no-meat` | No meat |
| `custom` | Custom |

**Detailed restrictions** (토글): Beef · Pork · Chicken · Fish · Seafood · Eggs · Onion · Garlic · Alcohol · Cross-contamination

### 티어 → 토글 프리셋

티어를 고르면 아래 토글이 자동으로 켜지고, **티어가 `custom`이 아니면 토글은 dim + 읽기 전용**. `custom` 선택 시 토글이 자유 편집 가능해지고 마지막 프리셋 값에서 시작.

| Muslim 티어 | 켜지는 토글 |
| --- | --- |
| `halal-certified` | pork, alcohol, porkDerived, gelatin, nonHalalMeat, crossContamination |
| `halal-meat` | pork, porkDerived, nonHalalMeat |
| `pork-alcohol-free` | pork, alcohol, porkDerived |
| `custom` | (사용자 편집) |

| Hindu 티어 | 켜지는 토글 |
| --- | --- |
| `vegetarian` | beef, pork, chicken, fish, seafood |
| `no-beef` | beef |
| `no-beef-pork` | beef, pork |
| `no-meat` | beef, pork, chicken, fish, seafood |
| `custom` | (사용자 편집) |

## 5. 데이터 모델

### `lib/types.ts`

```ts
export type ProfileKind = 'muslim' | 'hindu';

export type RestrictionKey =
  | 'pork' | 'alcohol' | 'porkDerived' | 'gelatin' | 'nonHalalMeat'
  | 'seafood' | 'crossContamination'
  | 'beef' | 'chicken' | 'fish' | 'eggs' | 'onion' | 'garlic';

export interface Preferences {
  profile: ProfileKind;
  tier: string;
  restrictions: Partial<Record<RestrictionKey, boolean>>;
  onboarded: boolean;
}

export interface Session {
  email: string | null;   // null = guest
  signedInAt: string;     // ISO
}
```

`onion`과 `garlic`은 UI에서는 별도 토글이지만 데이터 축은 하나(`containsOnionGarlic`)로 매핑한다 — 둘 중 하나라도 켜지면 해당 축을 필터에 반영.

### `RestaurantAttributes` 확장

```ts
export interface RestaurantAttributes {
  containsPork: boolean;
  servesAlcohol: Tristate;
  containsBeef: boolean;
  vegetarianFriendly: boolean;
  containsChicken: boolean;
  containsFish: boolean;
  containsSeafood: boolean;
  containsEgg: boolean;
  containsOnionGarlic: boolean;
  porkDerivedIngredients: Tristate;
  containsGelatin: Tristate;
  nonHalalMeat: Tristate;
  halalCertified: boolean;
  crossContaminationRisk: Tristate;
}
```

기존 28개 목데이터에 새 필드를 **명시적으로** 추가한다. cuisine별 템플릿에서 출발:

- `korean-chicken` (삼계탕/닭한마리): chicken=true, fish/seafood/beef=false, egg=false, onionGarlic=true, porkDerived='unknown'(육수), gelatin=false, nonHalalMeat=true, halalCertified=false, crossContam=false
- `seafood`: fish/seafood=true, chicken/beef=false, onionGarlic=true, nonHalalMeat=false, 나머지 false/'unknown'
- `korean-beef` (한우): beef=true, chicken/fish/seafood=false, onionGarlic=true, nonHalalMeat=true
- `temple` (사찰): 모든 육류/생선/알 false, onionGarlic=false(오신채 배제), vegetarianFriendly=true, alcohol=false
- `halal` / `middle-eastern` / `indian`: halalCertified=true(halal만) 또는 nonHalalMeat=false, porkDerived=false, gelatin=false, crossContam=false, chicken=true, seafood 다양
- 각 식당의 기존 `confidence`가 `phone`이면 Tristate 필드를 확정값으로, `menu`/`name`이면 애매한 축은 `'unknown'` 유지

## 6. 필터 재작업

### `RestaurantFilter` 확장

```ts
export interface RestaurantFilter {
  restrictions?: Partial<Record<RestrictionKey, boolean>>;
  requireHalalCertified?: boolean;
  requireVegetarian?: boolean;
  cuisines?: string[];
  sigunguCode?: string;
}
```

기존 `avoidPork/avoidAlcohol/avoidBeef/vegetarianOnly` 필드는 제거하고 `restrictions` 맵으로 일원화.

### `applyRestaurantFilter`

각 활성 restriction에 대해 **확정 충돌**일 때만 제외. `'unknown'`은 통과(UI에서 별도 표기).

| restriction | 제외 조건 |
| --- | --- |
| `pork` | `containsPork === true` |
| `alcohol` | `servesAlcohol === true` |
| `porkDerived` | `porkDerivedIngredients === true` |
| `gelatin` | `containsGelatin === true` |
| `nonHalalMeat` | `nonHalalMeat === true` |
| `seafood` | `containsSeafood === true` |
| `crossContamination` | `crossContaminationRisk === true` |
| `beef` | `containsBeef === true` |
| `chicken` | `containsChicken === true` |
| `fish` | `containsFish === true` |
| `eggs` | `containsEgg === true` |
| `onion` 또는 `garlic` | `containsOnionGarlic === true` |

추가 규칙:
- `requireHalalCertified` (Muslim 티어 `halal-certified`) → `halalCertified === true` 아니면 제외
- `requireVegetarian` (Hindu 티어 `vegetarian`) → `vegetarianFriendly === true` 아니면 제외

### `filterFromPreferences(p: Preferences): RestaurantFilter`

```ts
{
  restrictions: p.restrictions,
  requireHalalCertified: p.profile === 'muslim' && p.tier === 'halal-certified',
  requireVegetarian: p.profile === 'hindu' && p.tier === 'vegetarian',
}
```

## 7. Explore & 상세 연동

- `ExploreView`: 항상 `filterFromPreferences(prefs)`를 기본 필터로 적용. 칩 행 = 프로필의 활성 restriction들(느슨하게 풀 수 있게 토글) + 기존 cuisine/halal-certified 칩. 프로필 요약 pill 표시(예: "☪️ Pork & alcohol free · +2").
- `FilterChips`: restriction 키 기반으로 렌더하도록 일반화. 칩 라벨은 `restrictions.*` 메시지 재사용.
- 식당 상세: **"Your restrictions"** 블록 추가 — 프로필의 각 활성 restriction에 대해 ✓(속성이 확실히 clear) / ?(unknown, 매장 확인 필요). 확정 충돌은 이미 필터로 빠지므로 여기 안 나옴.

## 8. i18n

4개 카탈로그 모두에 추가/재작성:
- `login.*` — title, emailLabel, passwordLabel, signIn, guest, demoNote
- `onboarding.*` — 재작성: `languageTitle, profileTitle, profileMuslim, profileHindu, detailsTitle, halalPrefTitle, meatPrefTitle, detailedTitle, back, next, done, customHint`
- `tiers.muslim.{halalCertified,halalMeat,porkAlcoholFree,custom}`, `tiers.hindu.{vegetarian,noBeef,noBeefPork,noMeat,custom}`
- `restrictions.{pork,alcohol,porkDerived,gelatin,nonHalalMeat,seafood,crossContamination,beef,chicken,fish,eggs,onion,garlic}`
- `restaurant.yourRestrictions`, `restaurant.restrictionClear`, `restaurant.restrictionUnknown`

키 패리티 테스트(`lib/i18n.test.ts`)가 게이트.

## 9. 테스트

- `lib/useSession.test.tsx` — signIn/게스트/signOut/persist/rehydrate.
- `lib/usePreferences.test.tsx` 재작성 — `setProfile`, `setTier`(프리셋 적용), `custom` 잠금 해제, `toggleRestriction`, `onboarded` 플래그, persist/rehydrate.
- `lib/filter.test.ts` 재작성 — restriction별 매핑, Tristate 통과, `requireHalalCertified`/`requireVegetarian`, onion|garlic 합산.
- `components/onboarding/*.test.tsx` — 티어 선택 시 토글 프리셋 + dim, custom 시 편집 가능.
- e2e `tests/e2e/onboarding.spec.ts` — 미인증 진입 → `/login` 리다이렉트 → 게스트 → 언어(ko) → 프로필(muslim) → 상세(pork-alcohol-free) → `/explore` 도달, 새로고침 후 바로 `/explore` 유지. RTL(`/ar/login`) `dir=rtl`.
- 기존 `smoke.spec.ts` 갱신 — 라우트 목록에서 `/start` 제거, 게이트를 통과하도록 세션/프로필을 미리 localStorage에 심는 헬퍼 추가(또는 각 테스트 시작 시 온보딩 완주).

## 10. 파일 구조

```
lib/
  useSession.ts (신규)
  usePreferences.ts (재작성)
  filter.ts (재작성)
  tiers.ts (신규 — 티어→프리셋 맵, 프로필별 restriction 목록)
  types.ts (수정)
  mockData.ts (attributes 확장)
components/
  onboarding/
    OnboardingGate.tsx (신규)
    ProfileCard.tsx (신규 — 기존 OnboardingCard 재사용 가능하면 재사용)
    TierSelect.tsx (신규)
    RestrictionToggles.tsx (신규)
    OnboardingSplash.tsx (신규 — 게이트 로딩 화면)
  explore/
    FilterChips.tsx (restriction 기반으로 일반화)
    RestaurantCard.tsx (태그 로직 정리)
app/[locale]/
  login/page.tsx + LoginForm.tsx (신규)
  onboarding/
    layout.tsx (신규 — 공통 래퍼, 진행 표시)
    language/page.tsx (신규)
    profile/page.tsx + ProfileStep.tsx (신규)
    details/page.tsx + DetailsStep.tsx (신규)
  start/ (삭제)
  layout.tsx (수정 — OnboardingGate 삽입)
  explore/ExploreView.tsx (수정)
  explore/[id]/page.tsx (수정 — Your restrictions 블록)
messages/{en,ko,ar,hi}.json (대량 추가)
```

## 11. 비범위

- 실제 인증/백엔드/비밀번호. 소셜 로그인. 계정 관리·로그아웃 UI(세션은 만들되 로그아웃 버튼은 이번 범위 밖, 다음 피드백 항목에서).
- Insight 모드는 이 흐름 뒤에 있지만 프로필을 사용하지 않음(그대로).
- 도시/위치 필터.
- 사용자가 이후에 줄 나머지 피드백 항목들.
