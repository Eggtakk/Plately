import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const geo = JSON.parse(readFileSync('public/sigungu.simplified.geojson', 'utf8'));
const features = geo.features.map((f) => ({ code: String(f.properties.code), ko: f.properties.name }));

function hash(s) {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

// Derived from the actual 2-digit prefixes present in
// public/sigungu.simplified.geojson (kostat-2018 scheme):
// ['11','21','22','23','24','25','26','29','31','32','33','34','35','36','37','38','39']
const GWANGYEOK = {
  '11': 'Seoul', '21': 'Busan', '22': 'Daegu', '23': 'Incheon', '24': 'Gwangju',
  '25': 'Daejeon', '26': 'Ulsan', '29': 'Sejong', '31': 'Gyeonggi', '32': 'Gangwon',
  '33': 'Chungbuk', '34': 'Chungnam', '35': 'Jeonbuk', '36': 'Jeonnam',
  '37': 'Gyeongbuk', '38': 'Gyeongnam', '39': 'Jeju',
};

const rows = features.map(({ code, ko }) => {
  const p2 = code.slice(0, 2);
  const metro = p2 === '11' || p2 === '21' || p2 === '39'; // Seoul/Busan/Jeju: higher baseline demand
  const demandScore = Math.round((metro ? 55 : 15) + hash(code + 'd') * 45);
  const supplyCount = Math.round((metro ? 6 : 0) + hash(code + 's') * (metro ? 20 : 4));
  const relief = supplyCount / Math.max(1, demandScore / 10);
  const gapIndex = Math.max(0, Math.min(100, Math.round(demandScore - relief * 30)));
  const trendVs2019 = Math.round((hash(code + 't') - 0.55) * 40);
  return {
    code,
    gwangyeok: GWANGYEOK[p2] ?? 'Other',
    name: { en: ko, ko, ar: ko, hi: ko }, // English district names are not in the source file yet
    demandScore, supplyCount, gapIndex, trendVs2019,
  };
});

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/region-gap.json', JSON.stringify(rows, null, 2));
console.log(`wrote ${rows.length} regions`);
