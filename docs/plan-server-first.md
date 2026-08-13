# 계획 — 계정 보관함을 서버 정본으로

> 작성: 2026-08-13. **같은 날 5단계까지 전부 반영했다.**
>
> 그때는 읽고 쓰는 곳이 늘 로컬이고 서버는 뒤에서 맞추는 사본이었다. 그것을
> 뒤집었다 — 로그인하면 서버가 정본, 비로그인은 원고 한 편짜리 체험.
>
> 지금 무엇이 사실인지는 [README의 원고 관리 절](../README.md#원고-관리)을 본다.
> 이 문서는 **왜 그렇게 했는지**의 기록이다.
>
> 계획과 달라진 것 하나 — 실제로 옮겨 보니 **색인은 서버에 있는데 본문은 이
> 브라우저에만 있는 원고**가 있었다(뒤에서 밀어 넣던 것이 다 가지 못했다). 그대로
> 두면 그 사람에게는 원고가 사라진 것이라, 묻지 않고 마저 올리는 길을 더했다
> (`liftAccountBodies`).

## 0. 왜 뒤집나

휴지통에서 완전히 지운 원고가 새로고침하면 되살아난다. 실제 API로 재현했다.

```
3. 휴지통에 버린다      GET → docs: []  trash: ['zzrepro1']
4. 완전 삭제 후 push    {"version":2,"folders":[],"docs":[],"trash":[]}
5. 새로고침이 받는 것    docs: [] | trash: ['zzrepro1'] | purged: []
   본문도 남아 있나 → 200
```

배선 하나가 빠진 게 아니다. **쓸 수 있는 사본이 둘인데 화해 규칙이 없다**는 것이
원인이고, 그 자리에서 같은 종류가 계속 나온다.

| 증상 | 까닭 |
|---|---|
| 완전 삭제가 되살아난다 | push는 upsert만 한다. 색인에서 빠졌다는 사실이 서버로 갈 길이 없다 |
| 30일 만료가 되풀이된다 | `tidy`가 매번 로컬에서 비우고, pull이 매번 되살린다 |
| 버리자마자 새로고침하면 돌아온다 | push는 1.5초 디바운스, unload flush 없음. pull이 로컬을 통째로 덮는다 |
| 다른 기기에서 지운 것이 안 지워진다 | 클라이언트가 `purged`(자취)를 받아 놓고 쓰지 않는다 |

`purgeEntries`와 `archive_tombstone`은 이미 있다. **부르는 곳이 없을 뿐이다.**

---

## 1. 그어지는 선

| | 비로그인 — 체험 | 로그인 — 보관함 |
|---|---|---|
| 원고 | **한 편** | 여러 편 |
| 폴더 · 정렬 · 휴지통 | 없다 | 있다 |
| 색인 | **없다** (제목·목표 두 값뿐) | 서버 D1 |
| 본문 | IndexedDB | 서버 D1 (+ IDB 대기열) |
| 읽기 | 로컬 | 서버 (라우트 loader · react-query) |
| 쓰기 | 로컬 | 서버 (연산 단위) |

비로그인을 "폴더만 막은 보관함"으로 두지 않는 이유는 그렇게 하면 코드가 줄지
않고 조건문만 늘기 때문이다. 한 편으로 줄이면 `StoreIndex`·칸(scope)·`tidy`·
`bootstrap`이 통째로 로그인 전용이 되고, 비로그인 쪽에는 키 두어 개만 남는다.

체험이 할 수 있는 일은 원고를 쓰고, 조판을 보고, 내보내는 것까지다. 그 이상은
로그인이다.

---

## 2. IndexedDB는 남는다 — 대기열로만

"IDB를 뺀다"가 아니라 **"IDB를 읽기 경로에서 뺀다."** 읽기가 로컬을 정본으로
보지 않으면 화해할 일이 없고, 지금 버그의 근원은 그것이었다.

본문 쓰기는 서버로 가되 성공할 때까지 IDB에 들고 있다가 비운다. 원고 앱에서
PUT 하나가 실패하면 문단이 사라지고, 메모리 재시도로는 탭을 닫는 순간을 못
막는다. 오프라인 기능이 아니라 안전망이다 — `writeDoc`·`SaveStatus`·
`SaveErrorBanner`가 이미 있어 얹을 것이 적다.

색인에는 대기열을 두지 않는다. 폴더 하나 만들다 실패하면 다시 누르면 된다.

---

## 3. 서버 API — 연산을 보낸다

### 색인 전체를 PUT하지 않는다

구현은 당장 되지만 last-write-wins라 탭 두 개면 서로 덮는다. 지금 버그의
사촌이 그대로 남는다.

### 서버가 `operations.ts`를 그대로 쓴다

경로 재작성·형제 재번호·`settleUnder`를 SQL로 다시 쓸 필요가 없다. 서버가
그 사용자 색인을 읽어 → 순수 함수를 적용 → 바뀐 행만 `batch`로 쓴다.

이건 이미 깔아 둔 길이다. `biome.json`이 두 곳에서 그렇게 적어 두었다.

> 색인을 다루는 순수 함수는 저장소를 몰라야 한다. 이 성질 덕분에 나중에
> 서버에서 같은 코드를 그대로 쓴다.

> 순수한 도메인 로직이 필요하면 entities나 shared에서 가져와라 — 그러라고
> `operations.ts`를 저장소로부터 떼어 놓았다.

### 엔드포인트

```
GET    /api/archive          색인 전체. 자취(tombstone)를 걸러서, 만료분을 먼저 비우고
POST   /api/archive/ops      연산 하나. 바뀐 뒤의 색인 전체를 돌려준다
GET    /api/archive/doc/:id  본문 (그대로)
PUT    /api/archive/doc/:id  본문 (그대로)
```

라우트를 연산마다 파일로 쪼개지 않는다. TanStack Start의 파일 라우트라 그러면
파일이 열 개 넘게 늘고, `operations.ts`와 1:1로 붙는 이름 하나가 더 읽기 쉽다.

`ArchiveOp`는 판별 유니온이고 `operations.ts`의 내보내기와 짝이 맞는다.

```ts
type ArchiveOp =
  | { kind: "createDoc"; path: Path }
  | { kind: "createFolder"; name: string; path: Path }
  | { kind: "duplicateDoc"; id: string }
  | { kind: "updateDoc"; id: string; patch: DocPatch }
  | { kind: "renameFolder"; id: string; name: string }
  | { kind: "placeEntry"; moving: Moving; to: Placement }  // 이동 · 끌어놓기 · 한 칸 밀기
  | { kind: "trashDoc"; id: string }
  | { kind: "trashFolder"; id: string }
  | { kind: "restore"; id: string }
  | { kind: "purge"; ids: string[] }
  | { kind: "purgeAll" };
```

응답으로 색인 전체를 돌려주는 이유는 한 사람의 색인이 작기 때문이다 — 원고
200편에 57KB. 델타를 설계할 값이 아니다.

### 낙관적 갱신이 서버와 같은 함수를 쓴다

클라이언트도 `operations.ts`로 다음 색인을 계산해 캐시에 먼저 앉히고, 응답이
오면 그것으로 덮는다. **양쪽이 같은 순수 함수라 낙관적 결과와 서버 결과가
어긋날 수 없다.** 낙관적 갱신에서 가장 자주 나는 버그가 여기서 원천봉쇄된다.

새 id는 서버가 만든다(`makeId`가 `newId` 인자를 받게 되어 있다). 낙관적으로
만든 원고의 id는 응답에서 바로잡는다 — 만들기만 예외로 두고, 나머지 연산은
id가 이미 있으므로 그대로 맞는다.

### 화면 쪽은 통로가 하나다

`useArchiveMutation`이 이미 색인 쓰기의 단일 통로다. 여기 안쪽만 갈아끼우면
부르는 쪽은 인자 모양만 바뀐다.

```ts
// 전
change((current) => trashDoc(current, doc.id));
// 후
change({ kind: "trashDoc", id: doc.id });
```

---

## 4. 휴지통

### 전부 비우기 (새로 만든다)

`docs/plan-projects.md`의 휴지통 그림에 이미 `[전부 비우기]`가 있었는데 만들지
않았다. `purgeAll` op + `TrashDialog` 머리에 단추 하나. 되돌릴 수 없으므로
`ConfirmDialog`로 한 번 더 묻고, 몇 개가 사라지는지 문장에 적는다.

### 만료 정리는 서버가 한다

`GET /api/archive`가 돌려주기 전에 30일 지난 것을 `purgeEntries`로 비운다.
cron 없이 충분하다 — 아무도 열지 않는 보관함의 휴지통은 비워질 이유가 없다.

### 자취를 존중한다

- `readArchive` — tombstone에 있는 id는 돌려주지 않는다
- `pushArchive`(체험 원고 올리기) — tombstone에 있는 id는 무시한다
- 응답의 `purged` 필드는 뺀다. 서버가 이미 걸러서 주므로 클라이언트가 알 일이 없다

---

## 5. 단계

각 단계 끝에 `pnpm gate`.

### 0. 내 원고부터 지킨다

지금 브라우저에 있는 원고를 잃으면 이 계획은 실패다.

- 내보내기로 전부 백업 (docx·txt)
- `wongoji:v1:*` localStorage와 IndexedDB `wongoji`를 JSON으로 덤프해 따로 보관

### 1. 서버가 정본이 될 수 있게 (화면은 안 건드린다)

- `ArchiveOp` 타입과 `applyOp` — 서버에서 `operations.ts` 호출
- `POST /api/archive/ops`
- `readArchive` 자취 필터 + 만료 자동 정리
- `purgeEntries` 배선 (`purge` · `purgeAll`)
- 시험: `applyOp` 단위 테스트(D1 없이 순수 함수로 검증) + curl 스모크로 §0의
  재현을 다시 돌려 **되살아나지 않는 것**을 확인

### 2. 로그인 화면을 서버에 붙인다

- `useArchive()` — react-query. 라우트 loader에서 미리 채운다
- `useArchiveMutation`을 op 전송 + 낙관적 갱신으로 갈아끼운다
- 부르는 쪽 아홉 곳 수정 (사이드바 · 트리 · 트래시 · 만들기 · 복제 · 초기화 ·
  에디터 · 폴더 쪽 · 브레드크럼)
- 본문: 읽기는 서버, 쓰기는 서버 PUT + IDB 대기열
- 이 단계가 끝나면 로그인 사용자에게 `useArchiveSync`가 필요 없다

### 3. 비로그인을 한 편으로 줄인다

- `features/solo-draft` — 본문 IDB 키 하나, 제목·목표 localStorage
- 사이드바를 감추고 그 자리에 로그인 유도
- 로그인하면 "이 원고를 계정으로 옮길까요?" — 한 편만 올린다
- **레거시 색인 임포터를 남긴다.** `wongoji:v1:index`가 있으면 통째로 계정에
  올리는 일회성 경로 (지금 `merge.ts`가 하는 일 그대로). 내 원고가 그 길로
  올라간다. 다 옮긴 뒤 다음 판에서 제거

### 4. 걷어낸다

| 지운다 | 까닭 |
|---|---|
| `features/archive-sync/model/use-archive-sync.ts` | pull/push 루프. 버그의 근원 |
| `entities/archive/api/index-storage.ts` | localStorage 색인이 없어진다 |
| `entities/archive/model/use-store-index.ts` | `useSyncExternalStore` → react-query |
| `entities/archive/model/migrate.ts` | 옛 판 올리기는 임포터가 한 번만 |
| `features/archive-bootstrap/` | 다듬을 로컬 색인이 없다 |
| `shared/lib/storage/scope.ts` 대부분 | 한 브라우저에 보관함이 하나뿐이면 칸이 필요 없다 |
| `use-scope-settled.ts` · `restoreStorageScope` · `markScopeSettled` | 세션을 기다리는 춤 전체 |
| `doc-storage.ts`의 `*In(scope)` 한 벌 | 남의 칸을 볼 일이 없다 |

문서도 함께 고친다. 이 저장소는 주석이 설계 문서라 두면 거짓말이 된다.

- `README.md` — 원고 관리 절, 저장소 표, 동기화 설명
- `CLAUDE.md` — "저장소는 칸으로 갈린다" 문단
- `docs/plan-projects.md` — 머리말에 "그 뒤로 달라진 것"을 한 줄 더
- `use-manuscript-doc`·`doc-storage`·`scope`의 주석들

### 5. 휴지통 비우기 UI

`purgeAll`은 1단계에 이미 있다. 단추와 확인만 얹는다.

---

## 6. 알고 넘어가는 것

**D1에 트랜잭션이 없다.** 읽고-고치고-쓰는 사이에 같은 사용자의 다른 요청이
끼면 하나가 묻힌다. 사람 한 명이 탭 두 개를 동시에 두드릴 때만 생기고, 지금은
감수한다. 필요해지면 색인에 버전 하나를 두고 낙관적 잠금을 건다.

**로그인 상태에서 네트워크가 끊기면 목록을 못 고친다.** 지금은 로컬로 계속
쓴다. 본문은 대기열이 받쳐 주지만 폴더·순서는 아니다. 오프라인은 나중 일로
미뤄 두는 것이지 없는 문제가 아니다.

**왕복이 붙는다.** 낙관적 갱신을 붙이지 않으면 이름 바꾸기·접기가 굼떠 보인다.
2단계에서 함께 한다.

---

## 7. 남는 것

`entities/archive/model/operations.ts`는 한 줄도 안 바뀐다. 저장소를 모르게
떼어 놓은 값을 여기서 받는다.
