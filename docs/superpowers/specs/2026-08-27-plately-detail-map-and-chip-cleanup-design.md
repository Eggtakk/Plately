# Plately — Detail-page map + Explore chip cleanup (feedback item 2)

- 작성일: 2026-08-27
- 상태: 승인됨 (2026-08-27)
- 전제: login/onboarding 관문이 `main`에 머지되어 있음.

## 1. 목표

1. 가게 상세(`/explore/[id]`)에서 지도가 사라지지 않게 한다 — Explore와 같은 분할 레이아웃으로, 오른쪽(모바일은 위)에 해당 가게 위치로 줌인된 지도 + 단일 마커.
2. Explore 필터 칩에서 프로필 상세에서 이미 고른 제한 항목(할랄/힌두 관련)을 중복 노출하지 않는다 — 프로필 제한은 조용히 계속 적용되고, 칩에는 요리 발견 필터 3개만. 상단에 프로필 요약 pill 추가.

## 2. 상세 페이지 분할 레이아웃

### 라우트 구조
`app/[locale]/explore/[id]/page.tsx` (서버 컴포넌트) 유지. `explore/layout.tsx`(TopBar + main + BottomTabs) 그대로 상속.

### 레이아웃
- `detail.module.css`에 `.view` grid 추가 — `explore.module.css`의 `.view`와 동일 패턴: `grid-template-columns: minmax(320px, 480px) 1fr; block-size: calc(100dvh - 64px); gap; padding`.
- 왼쪽 `.panel` — 현재 `<article>` 내용(hero / whyListed / attributes / YourRestrictions / repMenu / disclaimer)을 `overflow-y: auto`로 스크롤. 기존 `max-inline-size: 680px; margin-inline: auto` 제거.
- 오른쪽 `.mapSlot` — `<DetailMap coords={r.coords} label={가게명} />`.
- `@media (width <= 900px)` → `grid-template-columns: 1fr`; 지도가 먼저(order), `block-size: 40vh`; 패널은 자연 높이.

### `components/map/DetailMap.tsx` (신규, client)
```tsx
'use client';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { BaseMap } from './BaseMap';

export function DetailMap({ coords, label }: { coords: [number, number]; label: string }) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  return (
    <BaseMap
      center={coords}
      zoom={15}
      label={label}
      onReady={(m) => {
        markerRef.current?.remove();
        markerRef.current = new maplibregl.Marker({ color: '#1F6E52' }).setLngLat(coords).addTo(m);
      }}
    />
  );
}
```
- `BaseMap`은 이미 `center`/`zoom`/`label`/`onReady` prop을 받음. `center`/`zoom`은 생성자에서만 쓰이므로 매 상세 진입 시 새 마운트 → 해당 좌표로 바로 줌인.
- 마커 색은 `--primary` 라이트값(`#1F6E52`) 하드코딩(마커는 지도 위 오버레이라 토큰 접근 불가). 다크에서도 충분히 보임.

### `[id]/page.tsx` 변경
- `<article className={styles.wrap}>` → `<div className={styles.view}><div className={styles.panel}>…기존 내용…</div><div className={styles.mapSlot}><DetailMap coords={r.coords} label={r.name[l] ?? r.name.en} /></div></div>`.
- import `DetailMap` from `@/components/map/DetailMap`.
- `r.coords`는 `[lng, lat]` — `DetailMap`에 그대로 전달.

## 3. Explore 필터 칩 정리

### `components/explore/FilterChips.tsx` 단순화
props: `{ extras: ExtraChip[]; activeExtras: Set<ExtraChip>; onToggleExtra: (k: ExtraChip) => void }`.
`export type ExtraChip = 'seafoodCuisine' | 'chickenCuisine' | 'koreanCuisine';` (`halalCertified` 제거).
restriction 렌더링 블록 전체 삭제. 남는 렌더: `extras.map(...)` 칩만. `aria-label`는 `explore.filtersLabel` 유지.
라벨 매핑: `seafoodCuisine → filters.seafood`, `chickenCuisine → filters.chicken`, `koreanCuisine → filters.korean`.

### `components/explore/ProfileSummary.tsx` (신규, client)
```tsx
'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { usePreferences } from '@/lib/usePreferences';
import styles from './ProfileSummary.module.css';

const ICON: Record<'muslim' | 'hindu', string> = { muslim: '☪️', hindu: '🕉️' };

export function ProfileSummary() {
  const te = useTranslations('explore');
  const { prefs, hydrated } = usePreferences();
  if (!hydrated || !prefs.profile || !prefs.tier) return null;
  return (
    <Link href="/onboarding/details" className={styles.pill}>
      <span aria-hidden>{ICON[prefs.profile]}</span>
      <span className={styles.label}>{te('myProfile')}: <TierName profile={prefs.profile} tier={prefs.tier} /></span>
      <span aria-hidden>›</span>
    </Link>
  );
}

function TierName({ profile, tier }: { profile: 'muslim' | 'hindu'; tier: string }) {
  const t = useTranslations(`tiers.${profile}`);
  return <>{t(tier)}</>;
}
```
`ProfileSummary.module.css`:
```css
.pill { display: inline-flex; align-items: center; gap: var(--space-2); padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper-raised); color: var(--ink); text-decoration: none; font-size: 13px; }
.pill:hover { border-color: var(--primary); }
.label { color: var(--ink-soft); }
```
- RTL: `›`는 방향성 문자 — `[dir="rtl"] .pill span:last-child { transform: scaleX(-1); }` 추가.

### `app/[locale]/explore/ExploreView.tsx` 변경
- 삭제: `loosened` state, `restrictionKeys`, `activeRestrictions` useMemo, `PROFILE_RESTRICTIONS` import, `onToggleRestriction`.
- `filter` useMemo:
  ```ts
  const filter = useMemo<RestaurantFilter>(() => {
    const fp = filterFromPreferences(prefs);
    const cuisines = [...extras].map((e) => EXTRA_CUISINE[e]);
    return { ...fp, cuisines: cuisines.length ? cuisines : undefined };
  }, [prefs, extras]);
  ```
  (`fp` = `{ restrictions, requireHalalCertified, requireVegetarian }` — 프로필/티어에서 그대로.)
- `EXTRA_CUISINE: Record<ExtraChip, string> = { seafoodCuisine: 'seafood', chickenCuisine: 'korean-chicken', koreanCuisine: 'korean' }`.
- **프로필 인지 칩 목록**: 프로필이 이미 제한하는 축의 요리 칩은 숨김.
  ```ts
  const RESTRICTION_FOR_EXTRA: Partial<Record<ExtraChip, RestrictionKey>> = { seafoodCuisine: 'seafood', chickenCuisine: 'chicken' };
  const shownExtras = (['seafoodCuisine','chickenCuisine','koreanCuisine'] as ExtraChip[])
    .filter((e) => { const r = RESTRICTION_FOR_EXTRA[e]; return !r || !prefs.restrictions?.[r]; });
  ```
- JSX: `<ProfileSummary />` 를 `<FilterChips>` 위에 렌더. `<FilterChips extras={shownExtras} activeExtras={extras} onToggleExtra={...} />`.
- 지도 핀 클릭 → `router.push('/explore/{id}')` 로직 유지.

## 4. i18n

4개 카탈로그 모두에 `explore.myProfile` 추가 (en "My profile", ko "내 프로필", ar "ملفي الشخصي", hi "मेरी प्रोफ़ाइल"). 키 패리티 테스트 통과. 다른 키 제거 없음(`filters.halalCertified`, `explore.tagHalal`는 다른 곳에서 여전히 사용/패리티 유지).

## 5. 테스트

- 유닛: `components/explore/ProfileSummary.test.tsx` — 프로필+티어가 있을 때 아이콘 + 티어 라벨 렌더, `href`가 `/onboarding/details`; 프로필 없으면 아무것도 안 그림.
- e2e `smoke.spec.ts`:
  - "loosening a restriction chip widens the result count" 테스트 → **교체**: 요리 칩(예: `Korean cuisine`) 토글 시 count가 좁혀지는지. 시드 프로필의 `restrictions`에 `seafood`/`chicken`이 없도록 해서 해당 칩이 보이게.
  - 신규: `/en/explore/r-yongsan-samgyetang` 방문 시 `role="application"` (지도 컨테이너) ≥ 1.
- `onboarding.spec.ts` — 영향 없음(온보딩 흐름 그대로).
- `a11y.spec.ts` — 라우트 목록에 `/en/explore/r-yongsan-samgyetang` 추가(선택). `region` 룰은 이미 비활성.

## 6. 파일 구조

```
components/map/DetailMap.tsx                 # 신규
components/explore/ProfileSummary.tsx + .module.css + .test.tsx  # 신규
components/explore/FilterChips.tsx           # 단순화 (props 축소, halalCertified 제거)
app/[locale]/explore/ExploreView.tsx         # restriction 칩 제거, ProfileSummary 추가, 프로필 인지 요리 칩
app/[locale]/explore/[id]/page.tsx           # 분할 레이아웃
app/[locale]/explore/[id]/detail.module.css  # .view/.panel/.mapSlot grid
messages/{en,ko,ar,hi}.json                  # explore.myProfile
tests/e2e/smoke.spec.ts                      # 칩 테스트 교체 + 상세 지도 체크
```

## 7. 비범위

- 오버레이/인터셉팅 라우트(분할 레이아웃 채택).
- 지도 flyTo 애니메이션(새 마운트로 충분).
- Explore에서 개별 제한 느슨하게 풀기(프로필에서 수정하도록 유도).
- Halal-certified 발견 필터(제거).
