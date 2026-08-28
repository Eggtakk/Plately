// model/out/*.json 을 검증하고 public/data/ 로 복사한다.
// 실패 시 non-zero exit — CI/개발자가 깨진 산출물을 커밋하지 않도록.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../../model/out');
const DEST = join(here, '../public/data');

const ATTR_KEYS = [
  'containsPork', 'servesAlcohol', 'containsBeef', 'vegetarianFriendly',
  'containsChicken', 'containsFish', 'containsSeafood', 'containsEgg',
  'containsOnionGarlic', 'porkDerivedIngredients', 'containsGelatin',
  'nonHalalMeat', 'halalCertified', 'crossContaminationRisk',
];
const CONFIDENCE = new Set(['name', 'menu', 'phone']);

function fail(msg) { console.error(`✗ ${msg}`); process.exitCode = 1; throw new Error(msg); }

function readJson(name) {
  const p = join(OUT, name);
  if (!existsSync(p)) fail(`missing ${p} — run: cd model && python -m scripts.run_pipeline`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

function validateRestaurants(list) {
  if (!Array.isArray(list) || list.length === 0) fail('restaurants.json empty');
  const ids = new Set();
  for (const r of list) {
    for (const k of ['id', 'name', 'area', 'sigunguCode', 'coords', 'cuisine', 'attributes', 'confidence', 'matchedTokens', 'repMenu'])
      if (!(k in r)) fail(`restaurant ${r.id ?? '?'} missing ${k}`);
    if (ids.has(r.id)) fail(`duplicate restaurant id ${r.id}`);
    ids.add(r.id);
    if (!r.name.en || !r.name.ko) fail(`restaurant ${r.id} name.en/ko`);
    for (const loc of ['name', 'area']) {
      const o = r[loc];
      if (!o || typeof o !== 'object') fail(`restaurant ${r.id} ${loc} not an object`);
      for (const lk of ['en', 'ko', 'ar', 'hi']) if (!o[lk]) fail(`restaurant ${r.id} ${loc}.${lk} missing`);
    }
    if (typeof r.sigunguCode !== 'string' || !r.sigunguCode) fail(`restaurant ${r.id} sigunguCode`);
    if (!Array.isArray(r.matchedTokens)) fail(`restaurant ${r.id} matchedTokens not array`);
    if (!Array.isArray(r.repMenu)) fail(`restaurant ${r.id} repMenu not array`);
    if (!Array.isArray(r.coords) || r.coords.length !== 2) fail(`restaurant ${r.id} coords`);
    const [lng, lat] = r.coords;
    for (const [lng2, lat2] of [r.coords]) if (typeof lng2 !== 'number' || typeof lat2 !== 'number') fail(`restaurant ${r.id} coords not numbers`);
    if (lng < 124 || lng > 132 || lat < 33 || lat > 39.5) fail(`restaurant ${r.id} coords out of Korea bbox`);
    if (!CONFIDENCE.has(r.confidence)) fail(`restaurant ${r.id} bad confidence ${r.confidence}`);
    for (const k of ATTR_KEYS) if (!(k in r.attributes)) fail(`restaurant ${r.id} attr ${k}`);
    const TRI = new Set([true, false, 'unknown']);
    for (const k of ATTR_KEYS) if (!TRI.has(r.attributes[k])) fail(`restaurant ${r.id} attr ${k} = ${JSON.stringify(r.attributes[k])} (want boolean|"unknown")`);
  }
}

function validateRegionGap(list) {
  if (!Array.isArray(list) || list.length < 220) fail(`region-gap.json has ${list?.length} rows (<220)`);
  const codes = new Set();
  for (const g of list) {
    for (const k of ['code', 'name', 'gwangyeok', 'demandScore', 'supplyCount', 'gapIndex', 'trendVs2019'])
      if (!(k in g)) fail(`region ${g.code ?? '?'} missing ${k}`);
    if (codes.has(g.code)) fail(`duplicate region code ${g.code}`);
    codes.add(g.code);
    if (typeof g.code !== 'string' || !g.code) fail(`region code not a string`);
    if (!g.name || typeof g.name !== 'object' || !g.name.ko) fail(`region ${g.code} name shape`);
    for (const nk of ['demandScore', 'supplyCount', 'gapIndex', 'trendVs2019'])
      if (typeof g[nk] !== 'number' || !Number.isFinite(g[nk])) fail(`region ${g.code} ${nk} not a finite number`);
    if (g.gapIndex < 0 || g.gapIndex > 100) fail(`region ${g.code} gapIndex ${g.gapIndex}`);
  }
}

const restaurants = readJson('restaurants.json');
const regionGap = readJson('region-gap.json');
const meta = readJson('_meta.json');
if (meta.sampleData !== true && meta.sampleData !== false) fail('_meta.json missing sampleData boolean');

validateRestaurants(restaurants);
validateRegionGap(regionGap);

if (meta.restaurants !== restaurants.length) fail(`_meta restaurants=${meta.restaurants} but array has ${restaurants.length}`);
if (meta.regions !== regionGap.length) fail(`_meta regions=${meta.regions} but array has ${regionGap.length}`);

writeFileSync(join(DEST, 'restaurants.json'), JSON.stringify(restaurants, null, 2) + '\n');
writeFileSync(join(DEST, 'region-gap.json'), JSON.stringify(regionGap, null, 2) + '\n');
writeFileSync(join(DEST, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');

console.log(`✓ synced ${restaurants.length} restaurants, ${regionGap.length} regions (sampleData=${meta.sampleData})`);
