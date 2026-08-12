#!/bin/sh
# 슬라이스의 index.ts는 배럴이어야 한다 — 구현이 들어가면 안 된다.
#
# `lib/export/index.ts`가 161줄짜리 구현이면서 index.ts라는 이름을 달고 있었다.
# 그러면 "이 슬라이스가 무엇을 내놓는가"를 파일을 열어 읽어야 알 수 있고,
# 배럴만 부르라는 규칙(biome)이 지켜져도 경계가 흐려진다.
#
# export · import · 주석 · 빈 줄 말고 다른 것이 있으면 실패한다.
set -e
bad=""
for f in src/entities/*/index.ts src/features/*/index.ts src/widgets/*/index.ts src/pages/*/index.ts; do
  [ -f "$f" ] || continue
  if grep -qvE '^(export|import|\}|\t|//|/\*| \*|$)' "$f"; then
    bad="$bad $f"
  fi
done
if [ -n "$bad" ]; then
  echo "배럴에 구현이 들어 있다:$bad" >&2
  exit 1
fi
echo "배럴 $(ls src/*/*/index.ts 2>/dev/null | wc -l | tr -d ' ')개 — 전부 재수출만"
