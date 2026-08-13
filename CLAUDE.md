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

**계정 원고의 정본은 서버다.** 브라우저는 `GET /api/archive`로 받아 그리고, 고칠
때는 색인을 밀어 넣지 않고 **연산 하나**를 보낸다(`POST /api/archive/ops`). 그 길로만
지운 것이 지웠다고 전해진다 — 색인 전체를 upsert하던 시절에는 완전히 삭제한 원고가
새로고침하면 되살아났다.

서버는 그 연산을 브라우저와 **같은 순수 함수**(`applyOp` → `operations.ts`)로 적용한다.
색인 규칙을 두 벌 쓰지 않는다. 새 연산이 필요하면 `operations.ts`에 순수 함수를 두고
`ops.ts`의 유니온에 한 줄 늘린다.

**비로그인은 원고 한 편이다.** 폴더·차례·휴지통은 계정 기능이라 그쪽에는 색인이
아예 없다(`features/solo-draft`). IndexedDB에 남은 것은 체험 원고 본문과, 계정 원고의
**미전송 대기열**(`wongoji:outbox`)뿐이다 — 대기열은 정본이 아니고, 보내는 데 성공하면
지운다.

지켜야 할 관례는 한 줄이다 — **별칭(`#/`) import는 슬라이스를 건너고, 상대
import(`./`)는 슬라이스 안에 머문다.**

**`src/server/`는 FSD 밖이다.** 서버 전용 코드(better-auth·D1·스키마)가 거기 산다.
프론트에서 `#/server`를 부르면 안 되고 — `cloudflare:workers`가 브라우저 번들에
실려 빌드가 깨진다 — 부를 수 있는 곳은 `routes`의 서버 핸들러뿐이다. 반대로
서버에서 `features`·`widgets`·`pages`를 부르는 것도 막혀 있다. 둘 다 biome이 잡는다.
