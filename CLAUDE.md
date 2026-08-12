# wongoji

## 개발 서버는 새로 띄우지 않는다

브라우저로 확인할 일이 있으면 **먼저 3000 포트를 본다.** 이미 떠 있고 그 프로세스의
cwd가 이 폴더면 그것을 그대로 쓴다.

```bash
PID=$(lsof -nP -iTCP:3000 -sTCP:LISTEN -t 2>/dev/null | head -1)
CWD=$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-)
[ "$CWD" = "$PWD" ] && echo "재사용: http://localhost:3000" || echo "없음 — pnpm dev 가능"
```

- 재사용이면 **`pnpm dev`를 부르지 않는다.** vite는 3000이 막혀 있으면 조용히
  3010, 3020으로 옮겨 가며 뜬다. 그러면 서버가 여러 벌 남고, 어느 것을 보고 있는지
  알 수 없게 되며, 사용자가 띄워 둔 창과 다른 포트를 보게 된다.
- cwd가 다른 폴더면 그건 남의 서버다. 포트를 뺏지 말고 사용자에게 알린다.
- 내가 띄운 것이면 일이 끝났을 때 반드시 내린다. 남기고 가지 않는다.

## 검사 관문

커밋 전에 `pnpm gate` 하나만 돌리면 된다 — typecheck · test · biome · 배럴 검사 · build.
넷을 손으로 나눠 돌리다 보면 biome을 빠뜨리게 된다.

## 구조

Feature-Sliced Design. 레이어와 슬라이스 규칙, 그리고 `biome.json` overrides의
함정은 [README의 구조 절](README.md#구조)에 적혀 있다.

지켜야 할 관례는 한 줄이다 — **별칭(`#/`) import는 슬라이스를 건너고, 상대
import(`./`)는 슬라이스 안에 머문다.**
