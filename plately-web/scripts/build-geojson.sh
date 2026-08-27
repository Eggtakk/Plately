#!/usr/bin/env bash
set -euo pipefail

# Builds public/sigungu.simplified.geojson: a bundled, simplified GeoJSON of
# South Korea's ~229 시군구 (municipal districts) for the Insight choropleth map.
#
# Output features carry exactly two properties:
#   code  string  5-digit 시군구 code
#   name  string  Korean district name

SRC="https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-geo.json"
# This source already names its fields `code` (5-digit 시군구 code) and `name`
# (Korean name), so we only strip the extras (base_year, name_eng) rather than
# renaming. Fallback if the primary source is unreachable:
#   SRC="https://raw.githubusercontent.com/raqoon886/Local_HangJeongDong/master/hangjeongdong_sigungu.geojson"
#   replace `-filter-fields code,name` with
#   `-rename-fields code=sigungu_cd,name=sigungu_nm -filter-fields code,name`

curl -sL "$SRC" -o /tmp/sigungu-raw.geojson

npx -y mapshaper /tmp/sigungu-raw.geojson \
  -simplify 5% keep-shapes \
  -filter-fields code,name \
  -o format=geojson precision=0.0001 public/sigungu.simplified.geojson

node -e "const fs=require('fs');const g=JSON.parse(fs.readFileSync('./public/sigungu.simplified.geojson','utf8'));console.log('features:',g.features.length);"
