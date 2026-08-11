# 200자 원고지

글을 200자 원고지(20칸 × 10줄) 규칙에 맞춰 조판해 주는 웹 에디터. 왼쪽에 글을 쓰면 오른쪽 원고지에 칸 단위로 채워지고, 그대로 인쇄하거나 PDF로 저장할 수 있다.

## 먼저 알아야 할 것 — 원고지에는 표준이 없다

국립국어원은 원고지 사용법이 **어문 규정의 대상이 아니라고 공식 확인한다.**

> "원고지 사용법에 관해서는 어문 규정에 규정되어 있지 않으므로 관행을 따르거나 관련 서적을 참고하시길 바랍니다."
> — [국립국어원 온라인가나다](https://m.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&qna_seq=322356&pageIndex=1)

그래서 자료마다 규칙이 실제로 충돌한다. 줄 끝 문장부호 처리만 해도 네 가지 방식이 병존한다.

이 앱은 유일하게 자기모순이 없어 그대로 알고리즘화할 수 있는 [TOPIK 공식 7개 항](https://exam.topik.go.kr/nasdata/webnas/raonkeditordata/uploadId/2024/02/20240227_175447974_51977.pdf)을 기준으로 삼는다. 조사한 규칙 전문과 자료 간 충돌, 근거를 찾지 못한 항목은 [`docs/wongoji-rules.md`](docs/wongoji-rules.md)에 출처와 함께 정리해 두었다.

## 기능

- **조판** — 한글 1칸, 소문자·숫자 2자 1칸, 줄표·줄임표 2칸, 문단 첫 칸 들여쓰기
- **문장부호** — `?` `!` 뒤 한 칸 비움, `.` `,` 뒤 안 비움, 줄 끝에 자리가 없는 부호는 마지막 칸에 글자와 합침
- **제목·소속** — 제목은 줄 가운데, 소속은 오른쪽(끝 2칸 비움)에 놓는 첫 장 헤더
- **빈 행** — 운문의 연 사이나 긴 인용의 위아래에 쓰는 빈 줄. 버튼 또는 `Ctrl+Enter`
- **인쇄 / PDF** — 전 장이 세로로 이어져 출력된다
- 원고는 브라우저 localStorage에 저장된다. 서버가 없다

## 개발

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # 조판 엔진 테스트
pnpm build
pnpm check        # Biome
```

## 배포 — Cloudflare Workers

설정은 되어 있다. 계정 인증만 하면 된다.

```bash
pnpm dlx wrangler login   # 최초 1회
pnpm run deploy           # build + wrangler deploy
```

- `wrangler.jsonc` — Worker 이름은 `wongoji`. 배포 URL은 `wongoji.<계정>.workers.dev`
- `vite.config.ts` — `@cloudflare/vite-plugin`이 SSR 환경을 Workers 런타임으로 돌린다. 개발 서버도 workerd에서 실행된다
- `pnpm dlx wrangler deploy --dry-run` 으로 배포 없이 번들을 검증할 수 있다 (현재 gzip 약 420 KiB)

서버 상태나 바인딩(KV·D1·R2)은 쓰지 않는다. 원고는 전부 브라우저에 있다.

## 구조

```
src/lib/wongoji/     조판 엔진 (프레임워크 비의존)
  types.ts           Cell·Block·Page 자료구조
  profile.ts         규칙 프로파일 (현재 TOPIK 하나)
  tokenize.ts        문자열 → 칸 단위 토큰
  layout.ts          토큰 → 줄 배치 → 장 배치
src/components/      원고지 렌더러, 에디터(Tiptap), 페이저(Swiper)
docs/wongoji-rules.md  규칙 명세서와 출처
```

엔진은 `텍스트 → 셀 토큰 → 줄 배치 → 장 배치` 3단으로 나뉜다. 규칙 프로파일이 줄 배치 단계에만 영향을 주도록 토큰화와 분리했다.

**셀 모델은 `glyphs: string[]`이다.** 한 칸에 두세 글리프가 들어가는 경우(숫자 2자, 줄 끝 부호 병합, 닫는 따옴표+마침표)가 규칙 자체에 내장되어 있어 단일 문자 모델로는 표현할 수 없다.

배치 로직을 지배하는 제약은 두 줄이고, 방향이 정반대라 분기가 필수다.

1. 줄 첫 칸에는 띄어쓰기와 닫는 부호(`.` `,` `?` `!`)가 올 수 없다
2. 줄 마지막 칸에는 여는 부호(`"` `'` `(`)가 올 수 없다

## 아직 없는 것

- **대화문 hanging indent** — 학교식 규칙에서는 대화 블록의 모든 줄이 첫 칸을 비운다. TOPIK 7개 항에 없어 넣지 않았다
- **운문·긴 인용 블록** — 2칸 들여쓰기와 자동 빈 행
- **`school` 프로파일** — 한 자리 숫자 1칸, `∨` 표시, 소속 끝 여백 3칸 등. `Profile` 인터페이스와 플래그는 이미 있어 값만 채우면 된다
