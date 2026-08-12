# 200자 원고지

글을 200자 원고지(20칸 × 10줄) 규칙에 맞춰 조판해 주는 웹 에디터. 공모전 요강이 "200자 원고지 70매"처럼 매수로 분량을 정하기 때문에, 분량 목표와 워드(.docx) 내보내기를 함께 둔다.

넓은 화면에서는 왼쪽에 글을 쓰고 오른쪽 원고지에 곧바로 조판된다. 좁은 화면에서는 자리를 나눌 수 없어 둘 중 하나만 띄우고 오른쪽 아래 토글로 오간다.

로그인하지 않아도 다 쓸 수 있다. 그때 원고는 이 브라우저에만 있다. 구글로 로그인하면
계정 보관함이 생기고 기기 사이에 따라다닌다 — 어느 쪽이든 **읽고 쓰는 곳은 늘 로컬이고,**
서버는 뒤에서 맞춘다.

## 먼저 알아야 할 것 — 원고지에는 표준이 없다

국립국어원은 원고지 사용법이 **어문 규정의 대상이 아니라고 공식 확인한다.**

> "원고지 사용법에 관해서는 어문 규정에 규정되어 있지 않으므로 관행을 따르거나 관련 서적을 참고하시길 바랍니다."
> — [국립국어원 온라인가나다](https://m.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&qna_seq=322356&pageIndex=1)

그래서 자료마다 규칙이 실제로 충돌한다. 줄 끝 문장부호 처리만 해도 네 가지 방식이 병존한다.

이 앱은 유일하게 자기모순이 없어 그대로 알고리즘화할 수 있는 [TOPIK 공식 7개 항](https://exam.topik.go.kr/nasdata/webnas/raonkeditordata/uploadId/2024/02/20240227_175447974_51977.pdf)을 기준으로 삼는다. 조사한 규칙 전문과 자료 간 충돌, 근거를 찾지 못한 항목은 [`docs/wongoji-rules.md`](docs/wongoji-rules.md)에 출처와 함께 정리해 두었다.

## 조판

- **칸 나누기** — 한글 1칸, 소문자·숫자 2자 1칸, 줄표·줄임표 2칸, 문단 첫 칸 들여쓰기
- **문장부호** — `?` `!` 뒤 한 칸 비움, `.` `,` 뒤 안 비움, 줄 끝에 자리가 없는 부호는 마지막 칸에 글자와 합침
- **대화문** — 따옴표가 닫힐 때까지 모든 줄의 첫 칸을 비운다(hanging indent). TOPIK 7개 항에는 없고 관행을 따른 것이라 프로파일 플래그로 뺄 수 있다
- **빈 행** — 운문의 연 사이나 긴 인용의 위아래에 쓰는 빈 줄. 버튼 또는 `Ctrl+Enter`

**제목은 조판하지 않는다.** 원고를 가리키는 이름일 뿐이라 원고지 칸을 차지해서는 안 되고 분량에도 세지 않는다. 워드로 내보낼 때는 문서 제목으로 들어간다.

### 매수와 장수는 다른 값이다

화면에 둘 다 나온다. 헷갈리기 쉬우므로 적어 둔다.

| | 계산 | 쓰는 곳 |
|---|---|---|
| **매** | 공백 포함 글자수 ÷ 200, 올림 | 공모전 분량 목표 |
| **장** | 실제로 조판된 원고지 장수 | 미리보기 쪽 번호 |

한글(HWP)의 원고지 매수는 "원고지에 옮겨 쓰는 것을 가정"한 **조판 기준**이라 이 앱의 매수와 어긋난다. 문단이 잦고 대화가 많은 소설일수록 벌어진다 — 측정값은 산문 4%, 대화 섞인 소설 18%, 대화 위주 71%. 요강이 빡빡하면 [`docs/contest-features.md`](docs/contest-features.md)의 측정을 보고 여유를 두는 편이 낫다.

## 원고 관리

- **폴더 트리** — 중첩 가능. 원고는 폴더 밖에도 놓을 수 있다(보이지 않는 root)
- **이동 · 복제** — 복제는 `제목 (사본)`, 겹치면 번호가 올라간다. 사본은 원본 바로 아래
- **차례** — 끌어다 사이에 끼우거나 ⋯ 메뉴의 위로·아래로. 폴더가 늘 원고 위에 온다
- **휴지통** — 30일 뒤 사라진다. 남은 날과, 폴더가 데리고 간 원고 수를 보여 준다
- **저장** — 타이핑이 멎고 300ms 뒤. 실패하면(주로 용량 초과) 배너가 뜨고 백업 내려받기를 권한다

### 색인과 본문을 나눈다

목록(제목·경로·차례·목표·분량)은 **색인 한 덩어리**로 localStorage에, 본문은 원고마다
따로 IndexedDB에 둔다. 목록을 그릴 때 원고를 열지 않아도 되게 나눈 것이다 — 색인은
원고를 열고 옮길 때마다 통째로 읽고 쓰므로, 여기에 본문이 섞이면 그 비용이 원고 수만큼
커진다.

둘을 다른 저장소에 둔 것은 크기 때문이다. 원고 200편 × 10,000자면 색인은 57KB라
localStorage(약 5MB)에 넉넉히 들어가지만 본문을 합치면 6–13MB로 넘긴다. **색인이
localStorage에 남아 있어야 하는 이유는 따로 있다** — 화면이 `useSyncExternalStore`로
그것을 구독하는데, 그 훅은 동기적이고 정체성이 안정된 스냅샷을 요구한다. 비동기인
IndexedDB로는 줄 수 없는 값이다.

`navigator.storage.persist()`를 요청해 브라우저가 용량을 정리할 때 원고를 먼저 버리지
않게 한다.

### 로그인하면 칸이 갈린다

같은 브라우저 안에서 비로그인 원고와 계정 원고가 서로 섞이지 않아야 한다. 저장하는
자리를 통째로 나눈다.

| | 색인 | 본문 |
| --- | --- | --- |
| 비로그인 | `wongoji:v1:index` | IndexedDB `wongoji` |
| 계정 | `wongoji:v1:u:<id>:index` | IndexedDB `wongoji:u:<id>` |

두 앞머리는 서로의 앞머리가 아니므로 고아 정리가 칸을 넘어갈 수 없다. 로그아웃하면
비로그인 칸이 그대로 다시 보인다.

**비로그인 원고가 있는 채로 로그인하면 옮길지 묻는다.** 묻지 않고 올리면 남의 컴퓨터를
잠깐 빌려 쓴 사람의 원고가 계정에 남는다. 답하기 전에는 보관함이 열리지 않는다 —
그러지 않으면 답하기도 전에 빈 원고가 만들어져 목록에 남는다.

### 서버와 주고받기

읽기는 **늘 로컬에서** 한다. 서버는 뒤에서 받아 로컬에 적을 뿐이고, 화면은 색인이
바뀌었다는 알림으로 따라온다. 그래서 사이드바도 에디터도 이 기능을 모른다.

- 로그인하면 계정 보관함을 받아 로컬에 적는다. 서버가 비었는데 로컬에 원고가 있으면
  덮지 않고 올린다 — 아직 못 올린 것이다
- 색인이 바뀌면 1.5초 뒤에 색인 전체를 밀어 넣는다. 본문은 그 원고 하나만
- 못 보냈으면 로컬 것으로 계속 쓴다. 다음 변경에 다시 간다

두 기기에서 같은 원고를 고치면 **나중에 밀어 넣은 쪽이 이긴다.** 항목마다 시각을 두고
병합하지 않는다.

## 내보내기

| 형식 | 쓰임 |
|---|---|
| **.docx** | 공모전 접수. 온라인 접수는 대부분 한글/워드로 받는다 |
| **.json** | 백업 · 복원 |
| **.txt** | 평문 |

docx는 [`docx`](https://github.com/dolanmiu/docx)(MIT)로 만들고, 내보낼 때만 따로 받아 온다(gzip 약 99KB).

## 개발

```bash
pnpm install
pnpm dev          # http://localhost:3000 (--host, 같은 망에서 접속 가능)
pnpm test         # 조판 엔진 · 보관함 · 변환기 · 내보내기
pnpm check        # Biome (포맷 · 린트 · 레이어 규칙)
pnpm build
pnpm gate         # 위 넷 + 배럴 검사. 커밋 전에 이것만 돌리면 된다
```

로그인까지 돌려 보려면 두 가지가 더 필요하다. 원고를 쓰고 조판하는 데는 없어도
된다 — 아무것도 막지 않기 때문이다.

```bash
cp .dev.vars.example .dev.vars    # 구글 자격증명과 시크릿을 채운다
pnpm db:migrate                   # 로컬 D1에 표를 만든다
```

`.dev.vars`는 git에 올라가지 않는다. 값을 어디서 얻는지는 [배포 절](#배포--cloudflare-workers)에 적혀 있고, 리디렉션 URI에 `http://localhost:3000/api/auth/callback/google`이 있어야 로컬에서 로그인이 끝난다.

### 개발 서버에서만 쓰는 계정

구글 동의 화면은 사람이 눌러야 지나므로, 그것 없이는 로그인한 뒤의 흐름(보관함
옮기기, 동기화)을 확인할 수 없다. 개발 서버에서만 이메일·비밀번호를 연다.

```bash
curl -c jar.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" \
  -d '{"email":"test@wongoji.local","password":"wongoji-test-1234","name":"테스트"}'

# 그 뒤로는 쿠키를 들고 다닌다
curl -b jar.txt http://localhost:3000/api/archive
```

브라우저에서 그 계정으로 들어가려면 개발자 콘솔에서 한 번 부르면 된다. 쿠키가
심기므로 새로고침하면 로그인 상태다.

```js
await fetch("/api/auth/sign-in/email", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test@wongoji.local", password: "wongoji-test-1234" }),
});
```

**Origin 헤더가 없으면 403이다** (`MISSING_OR_NULL_ORIGIN`). curl은 붙여 주지 않는다.

`import.meta.env.DEV`는 vite가 빌드할 때 `false`로 바꿔 박으므로 배포본에서는 이
길이 죽은 코드가 되어 사라진다 — `dist`에서 `emailAndPassword: void 0`으로 남는
것을 확인할 수 있다. 환경변수로 걸면 그렇게 되지 않으므로 바꾸지 않는다.

## 배포 — Cloudflare Workers

로그인이 들어오면서 D1과 시크릿이 필요해졌다. 아래 넷은 최초 1회만 하면 된다.

### 1. 계정 인증

```bash
pnpm dlx wrangler login --device
```

`--device`는 브라우저를 띄우는 대신 짧은 코드와 주소를 화면에 적어 준다. 그
주소를 손에 있는 아무 브라우저에서나 열어 코드를 넣으면 된다. **SSH로 붙어
있거나 컨테이너 안이면 이쪽을 쓴다** — 기본 흐름은 `localhost:8976`으로 콜백을
받는데, 원격 셸에서는 그 포트가 내 브라우저에 보이지 않아 로그인이 끝나지 않는다.

사람이 없는 곳(CI)이면 토큰을 환경변수로 준다. 이러면 `login`이 아예 필요 없다:

```bash
export CLOUDFLARE_API_TOKEN=...     # Workers Scripts:Edit + D1:Edit
export CLOUDFLARE_ACCOUNT_ID=...
```

토큰은 대시보드 → My Profile → API Tokens에서 만든다. `Edit Cloudflare Workers`
템플릿에 **D1:Edit**을 더하면 배포와 마이그레이션이 둘 다 된다.

### 2. D1 만들기

```bash
pnpm dlx wrangler d1 create wongoji
```

출력에 찍힌 `database_id`를 `wrangler.jsonc`의 자리표시자와 바꾼다. 그다음 표를
만든다:

```bash
pnpm db:migrate:remote
```

로컬은 `pnpm db:migrate`. `.wrangler` 아래 SQLite에 같은 SQL을 넣으며, 이쪽은
`database_id`를 보지 않으므로 자리표시자인 채로도 돌아간다.

### 3. 시크릿 넷

`.dev.vars`는 로컬 전용이라 배포에는 올라가지 않는다. 따로 넣어야 한다.

```bash
pnpm dlx wrangler secret put BETTER_AUTH_SECRET    # openssl rand -base64 32
pnpm dlx wrangler secret put BETTER_AUTH_URL       # https://<배포주소> — 끝에 슬래시 없이
pnpm dlx wrangler secret put GOOGLE_CLIENT_ID
pnpm dlx wrangler secret put GOOGLE_CLIENT_SECRET
```

`BETTER_AUTH_URL`이 틀리면 구글이 엉뚱한 주소로 돌려보내 로그인이 조용히 실패
한다. 배포 주소가 정해진 뒤에 넣는다.

### 4. 구글 콘솔에 배포 주소 더하기

[사용자 인증 정보](https://console.cloud.google.com/apis/credentials)의 승인된
리디렉션 URI. 개발용과 **둘 다** 있어야 한다 — 하나로 갈아 끼우면 로컬이 죽는다.

```
http://localhost:3000/api/auth/callback/google
https://<배포주소>/api/auth/callback/google
```

### 배포

**스키마를 고쳤으면 마이그레이션이 먼저다.** 컬럼이 없는 채로 새 코드가 뜨면 보관함
읽기가 깨진다 — 그동안 접속한 사람은 빈 목록을 본다.

```bash
pnpm db:migrate:remote    # 스키마가 바뀌었을 때만
pnpm run deploy           # build + wrangler deploy
```

- `wrangler.jsonc` — Worker 이름은 `wongoji`. 배포 URL은 `wongoji.<계정>.workers.dev`
- **`wrangler.jsonc`를 고쳤으면 `pnpm cf-typegen`을 다시 돌린다.** `env`의 타입이 거기서 나오고, 빠뜨리면 엉뚱한 곳에서 typecheck가 깨진다
- `vite.config.ts` — `@cloudflare/vite-plugin`이 SSR 환경을 Workers 런타임으로 돌린다. 개발 서버도 workerd에서 실행된다
- `pnpm dlx wrangler deploy --dry-run` 으로 배포 없이 번들을 검증할 수 있다

D1에는 로그인 정보(`user`·`session`·`account`·`verification`)와 계정 보관함
(`archive_folder`·`archive_doc`·`archive_doc_content`·`archive_tombstone`)이 있다.
**로그인하지 않은 원고는 올라가지 않는다** — 그것은 이 브라우저 것이다.

## 구조

[Feature-Sliced Design](https://feature-sliced.design)으로 나눈다. 위층은 아래층만
부를 수 있고, 같은 층끼리는 부르지 못한다. 슬라이스 바깥에서는 `index.ts`만 본다.

```
src/
  routes/            APP — 라우팅. 주소를 읽어 page에 넘기는 3줄짜리 어댑터들
    _app.tsx           주소에 없는 레이아웃. 보관함을 두르고 다듬기를 한 번 돌린다
    api.*.ts           계정 보관함 · better-auth 핸들러. 서버에서만 돈다
  pages/             home · editor · folder — 화면 하나를 짜 맞춘다
  widgets/           app-shell · manuscript-sidebar · manuscript-bar · page-header
  features/          무언가를 하는 것들
    reorder-entry/     끌어 놓기. 트리와 폴더 쪽이 나눠 쓴다
    archive-sync/      계정과 주고받기 · 로그인할 때 옮길지 묻기
    archive-bootstrap/ 앱 열 때 다듬기
    auth/              로그인 단추 · 저장소 칸 맞추기
    create-entry · move-entry · copy-manuscript · edit-manuscript ·
    reset-manuscript · manage-trash · export-manuscript · toggle-pane
  entities/
    archive/           보관함. 색인 하나가 폴더·원고·휴지통을 함께 들고 있다
      api/               색인 저장소 (localStorage, 칸별)
      lib/path.ts        materialized path 계산
      model/             자료구조 · 순수 연산 · 판 올리기 · 구독 훅 · 저장 실패 상태
    manuscript/        원고
      api/               본문 저장소 (IndexedDB, 칸별)
      lib/typesetting/   조판 엔진 (프레임워크 비의존)
      lib/tiptap.ts      에디터 문서 ↔ 조판 블록
      lib/serialize.ts   평문 · 백업 JSON 읽고 쓰기
  shared/            도메인을 모르는 것들 — shadcn 원본, cn, 저장소 겉포장과 칸
  server/            FSD 밖. better-auth · D1 · 스키마 (아래 절 참고)
docs/                규칙 명세서, 공모전 조사, 설계 기록
```

**두 entity로 나눈 이유** — 색인이 JSON 한 덩어리라 폴더·원고·휴지통을 따로 뗄 수
없다. `placeEntry`·`restore`·`countDocsUnder`가 셋을 함께 만지므로, 쪼개면 슬라이스를
가로지르는 호출이 강제로 생긴다. 반대로 본문은 원고별 키라 완전히 따로 산다.

**두 entity가 함께 필요하면 feature로 올린다.** `tidy`가 그 예다 — 색인이 무엇을
아는지와 본문 키가 무엇이 있는지를 맞대어 보는 일이라 어느 한쪽에 둘 수 없다.

### 레이어 규칙은 도구가 지킨다

`biome.json`의 `overrides` + `noRestrictedImports`. 새 의존성은 없다.

- `#/entities/*/**`는 걸리고 `#/entities/manuscript`는 통과한다 → **배럴만 허용**이
  허용 목록 없이 성립한다
- 지켜야 할 관례는 한 줄이다 — **별칭(`#/`) import는 슬라이스를 건너고, 상대
  import(`./`)는 슬라이스 안에 머문다**
- `scripts/check-barrels.sh`가 `index.ts`에 구현이 들어가는 것을 막는다.
  `lib/export/index.ts`가 161줄짜리 구현이면서 배럴 이름을 달고 있던 적이 있다

**함정** — `overrides`는 규칙 옵션을 합치지 않고 **갈아 끼운다.** 한 파일이 두
override에 걸리면 뒤엣것만 산다. 그래서 `entities/archive/lib/**`용 블록이 위의
entities 규칙을 통째로 다시 적고 있다. 여기에 규칙을 더할 때는 두 곳 다 고쳐야 한다.

### 폴더와 원고의 차례

색인의 `order`가 정한다. **뜻이 통하는 범위는 `(path, kind)` 하나뿐이다** — 같은
폴더의 폴더끼리, 같은 폴더의 원고끼리. 폴더는 늘 원고 위에 오므로 둘을 한 줄에
세울 일이 없고, 그래서 순서도 두 벌이다.

값은 0부터 빈틈 없이 매기고 옮길 때마다 그 형제 목록을 다시 번호 매긴다. 소수
자리를 두는 방식(fractional rank)을 쓰지 않는 것은 **저장 단위가 색인 전체**이기
때문이다 — `writeIndex`가 localStorage 덩어리를 통째로 다시 쓰고 `pushArchive`가
행 전부를 upsert한다. "한 항목만 고쳐 보낸다"로 벌 것이 없는데 자리 표류와
재조정은 그대로 짊어진다.

**옮기는 길은 `placeEntry` 하나다.** 끌어 놓기도, ⋯ 메뉴의 이동도, 위·아래로 미는
`nudgeEntry`도 전부 그리로 온다. 아무것도 바뀌지 않으면 받은 색인을 그대로
돌려주므로, 화면은 "놓을 수 있는가"를 따로 세지 않고 **놓아 보고 색인이 그대로면
놓을 것이 없다**로 읽는다.

두 기기에서 각자 차례를 바꾸면 나중에 밀어 넣은 쪽이 이긴다. 제목·경로가 이미
그렇다 — 색인 전체를 올리기 때문이다.

### 서버 코드는 FSD 밖에 있다

FSD는 화면을 나누자고 만든 규칙이다. D1 바인딩과 OAuth 시크릿을 쥔 코드에
슬라이스를 씌울 이유가 없어서 `src/server/`는 레이어 바깥에 둔다.

| 파일 | 무엇 |
| --- | --- |
| `src/server/auth.ts` | better-auth 인스턴스 (D1 · 구글) |
| `src/server/db.ts` | drizzle over D1 |
| `src/server/session.ts` | 요청에서 사용자 꺼내기 · 401 |
| `src/server/archive.ts` | 계정 보관함 읽고 쓰기. 소프트 삭제 ↔ 휴지통 배열 번역이 여기 한 곳에 있다 |
| `src/server/schema/auth.ts` | better-auth CLI가 만든다. 손으로 고치지 않는다 |
| `src/server/schema/archive.ts` | 보관함 테이블. 브라우저의 `StoreIndex`를 옮긴 것이라 mpath도 그대로다 |
| `src/shared/api/auth-client.ts` | 브라우저 쪽 짝. 서버와 코드를 나눠 갖지 않고 HTTP로만 만난다 |
| `src/routes/api.auth.$.ts` | `/api/auth/*`를 전부 받는 핸들러 |
| `src/routes/api.archive*.ts` | 계정 보관함. 색인 하나와 원고 하나짜리가 따로 있다 |

`schema/auth.ts`를 다시 뽑을 때:

```bash
npx auth generate --adapter drizzle --dialect sqlite --output src/server/schema/auth.ts
```

밖에 있다는 것이 규칙이 없다는 뜻은 아니다. 화면 쪽 규칙을 지지 않을 뿐이고,
대신 선이 둘 있다. 둘 다 biome이 지킨다.

- **프론트 → `#/server`는 막힌다.** `cloudflare:workers`가 브라우저 번들에
  실리면 빌드가 깨진다. 부를 수 있는 곳은 `routes`의 서버 핸들러뿐이다
- **`#/server` → `features`·`widgets`·`pages`는 막힌다.** 서버가 화면을 조립할
  일은 없다. 순수한 도메인 로직이 필요하면 `entities`·`shared`에서 가져온다 —
  그러라고 `operations.ts`를 저장소로부터 떼어 놓았다

**함정** — `createFileRoute`의 `server` 옵션은 `@tanstack/react-router`가 아니라
react-start가 `declare module`로 얹는다. `src/` 어디에서도 react-start를 부르지
않으면 그 선언이 안 들어와 "`server`라는 속성이 없다"고 나온다. 그래서 api 라우트에
`import type {} from "@tanstack/react-start"` 한 줄이 있다 — 런타임에는 아무것도
하지 않는다.

**함정** — `overrides`가 규칙을 갈아 끼우는 탓에(위 참고) `#/server` 금지는 프론트
다섯 레이어의 블록마다 **따로 적혀 있다.** `entities/archive` 전용 블록도 그중
하나다. 한 곳만 고치면 나머지에 구멍이 남는다.

### 조판 엔진

`텍스트 → 셀 토큰 → 줄 배치 → 장 배치` 3단으로 나뉜다. 규칙 프로파일이 줄 배치 단계에만 영향을 주도록 토큰화와 분리했다.

**셀 모델은 `glyphs: string[]`이다.** 한 칸에 두세 글리프가 들어가는 경우(숫자 2자, 줄 끝 부호 병합, 닫는 따옴표+마침표)가 규칙 자체에 내장되어 있어 단일 문자 모델로는 표현할 수 없다.

배치 로직을 지배하는 제약은 두 줄이고, 방향이 정반대라 분기가 필수다.

1. 줄 첫 칸에는 띄어쓰기와 닫는 부호(`.` `,` `?` `!`)가 올 수 없다
2. 줄 마지막 칸에는 여는 부호(`"` `'` `(`)가 올 수 없다

### 원고지 미리보기는 가상화되어 있다

82장짜리 원고를 통째로 그리면 원고지 칸 16,400개 · DOM 27,759개가 되어 원고 ↔ 원고지 전환에 렌더러가 45초 넘게 멈춘다(재현됨). 게다가 데스크탑 2열에서는 원고지가 늘 화면에 있어 **타이핑 한 글자마다 그 칸이 전부 다시 그려진다.** `@tanstack/react-virtual`로 보이는 장만 그린다. 측정은 [`docs/plan-2col-virtual.md`](docs/plan-2col-virtual.md)에 있다.

### 에디터

Tiptap을 최소 스키마로 쓴다 — 문단, 글자, 빈 행뿐이고 마크가 없다. 원고지에는 굵게·제목·목록이 없기 때문이고, 덕분에 서식 있는 글을 붙여 넣어도 스키마에 없는 마크가 떨어져 나가 평문으로 들어온다.

## 아직 없는 것

- **운문·긴 인용 블록** — 2칸 들여쓰기와 자동 빈 행
- **`school` 프로파일** — 한 자리 숫자 1칸, `∨` 표시 등. `Profile` 인터페이스와 플래그는 이미 있어 값만 채우면 된다
- **첫 장 헤더** — 제목·소속을 첫 장에 앉히는 것. 엔진에 흔적이 남아 있었지만
  도달할 수 없는 코드라 걷어냈다. 다시 넣는다면 `Block`을 늘리는 것이 아니라
  원고지 첫 장을 따로 다루는 편이 맞다
- **항목 단위 병합** — 두 기기에서 같은 원고를 고치면 나중에 밀어 넣은 쪽이 이긴다.
  제대로 하려면 항목마다 고친 시각이 있어야 하고, 그러면 색인 전체를 올리는 지금
  방식부터 갈아야 한다
- **끌기로 목록 건너뛰기** — 사이드바에서 폴더 쪽 목록으로 끌어 넘기는 것. 두 벌의
  끌기 상태를 하나로 묶어야 하고 손가락 쪽은 창에 얹은 리스너가 서로를 덮는다.
  목록 사이를 옮기는 길은 ⋯ 메뉴의 이동에 있다
- **차례를 키보드로 끌기** — 위로·아래로는 있지만 붙든 채 여러 칸 옮기는 것은 없다
