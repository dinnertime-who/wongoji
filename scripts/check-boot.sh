#!/bin/sh
# 빌드한 워커가 실제로 뜨는지 본다.
#
# **`vite build`가 성공하는 것과 워커가 뜨는 것은 다른 일이다.** Cloudflare
# Workers는 전역 스코프에서 난수 생성·타이머·네트워크를 금지하는데, 개발
# 서버는 모듈을 요청 안에서 평가하므로 그 자리가 전역이 아니다. 빌드본만
# 진짜 전역이 되고, 걸리면 **워커가 아예 못 떠서 모든 요청이 500이 된다.**
#
# 실제로 그렇게 프로덕션을 한 번 내렸다. id 생성기를 모듈 최상단에서 만들었고,
# typecheck·test·biome·build가 전부 통과한 채로 배포되었다.
#
# 그래서 한 번 띄우고 두드려 본다. 로그인 없이 닿는 두 곳이면 충분하다 —
# 워커가 뜨기만 하면 나머지는 다른 검사가 본다.
set -e

# 포트를 못박는다. preview는 자리가 차 있으면 조용히 옆 포트로 옮겨 가는데,
# 그러면 검사가 엉뚱한 것을 두드리거나 주소를 찾느라 헤맨다.
PORT=4199
URL="http://localhost:$PORT"

LOG=$(mktemp)
pnpm preview --port "$PORT" --strictPort >"$LOG" 2>&1 &
PID=$!
# 실패로 빠져나가도 반드시 내린다. 남기고 가면 다음 검사가 포트를 못 잡는다
trap 'kill "$PID" 2>/dev/null || true; rm -f "$LOG"' EXIT

fail=""
for path in "/" "/api/auth/get-session"; do
	# `--retry-connrefused`가 뜰 때까지 기다리는 일까지 함께 한다
	code=$(curl -s --retry-connrefused --retry 60 --retry-delay 1 \
		-o /dev/null -w "%{http_code}" -m 30 "$URL$path" || echo "000")
	[ "$code" = "200" ] || fail="$fail $path($code)"
done

if [ -n "$fail" ]; then
	echo "빌드한 워커가 200을 주지 않는다:$fail" >&2
	# 전역 스코프 위반이면 그 줄에 이유가 적혀 있다
	grep -iE "Disallowed operation|Error" "$LOG" | head -5 >&2 || true
	exit 1
fi

echo "빌드한 워커 부팅 확인 — $URL"
