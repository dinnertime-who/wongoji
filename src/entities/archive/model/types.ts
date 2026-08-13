import type { DocStatus } from "../config/status";

/**
 * 원고 보관함의 자료구조.
 *
 * 폴더 트리는 부모 id를 들고 다니지 않고 **조상 사슬을 경로 문자열로 박아 둔다**
 * (materialized path). 우리에게 제일 잦은 조회가 "이 폴더 아래 전부"이기 때문이다 —
 * 폴더를 지울 때, 휴지통에 넣을 때, 되살릴 때 모두 그것이고 접두사 검사 한 번으로
 * 끝난다. 근거는 docs/plan-projects.md.
 */

/** 조상 id를 슬래시로 이은 것. `"/"`는 보이지 않는 root */
export type Path = string;

/**
 * 형제 사이에서 몇 번째인가. 0부터 빈틈 없이.
 *
 * **뜻이 통하는 범위는 `(path, kind)` 하나뿐이다.** 같은 폴더에 든 폴더끼리,
 * 같은 폴더에 든 원고끼리만 견준다 — 폴더는 늘 원고 위에 오므로 둘을 한 줄에
 * 세울 일이 없고, 그래서 순서도 두 벌이다.
 *
 * 소수 자리를 두는 방식(fractional rank)을 쓰지 않는다. 그쪽이 버는 것은 "한
 * 항목만 고쳐 보낸다"인데, 여기서는 저장 단위가 색인 전체다 — `writeIndex`가
 * localStorage 덩어리를 통째로 다시 쓰고 `pushArchive`가 행 전부를 upsert한다.
 * 벌 것이 없는데 자리 표류와 재조정은 그대로 짊어진다.
 */
type Order = number;

export interface FolderEntry {
	id: string;
	name: string;
	/** 이 폴더가 놓인 자리. 자기 id는 들어가지 않는다 */
	path: Path;
	order: Order;
}

export interface DocEntry {
	id: string;
	title: string;
	path: Path;
	order: Order;
	/** 목표 매수. 0이면 목표를 두지 않은 것 */
	goal: number;
	/** 목록에서 보여줄 값 — 문서를 열지 않고도 알 수 있게 색인에 함께 둔다 */
	chars: number;
	/**
	 * 진행 상태. 없으면 라벨을 안 단 것이다 — **그것이 기본이다.**
	 *
	 * 있을 수도 없을 수도 있고(옛 원고), 사람이 지워서 null일 수도 있다. 둘 다
	 * "없음"으로 읽으면 된다.
	 */
	status?: DocStatus | null;
	/** 지금 상태가 된 시각. 전 이력은 서버의 `archive_doc_version`이 들고 있다 */
	statusAt?: number | null;
	/**
	 * 매수. **조판해 보고 나온 장수다**(`LayoutStats.sheets` 참고).
	 *
	 * 본문을 읽어야 나오는 값이라 여기 적어 둔다. 원고를 열 때 다시 세어 어긋나
	 * 있으면 고친다 — 셈법을 바꾸기 전에 적힌 값도 그때 바로잡힌다.
	 */
	sheets: number;
	createdAt: number;
	updatedAt: number;
}

/**
 * 버려진 것.
 *
 * 원고는 제목과 목표를 함께 들고 간다. 되살릴 때 돌려주어야 하고, 휴지통 목록에서
 * 어느 원고인지 알아볼 유일한 단서이기도 하다. 본문과 달리 짧은 값이라 색인에
 * 두어도 무겁지 않다.
 *
 * **순서는 들고 가지 않는다.** 되살릴 자리가 그대로 있다는 보장이 없어서다 —
 * 조상 폴더가 사라졌으면 `settleUnder`가 다른 데로 올려 보내고, 그러면 그 숫자가
 * 가리키던 형제 목록 자체가 다른 것이 된다. 되살린 것은 맨 끝으로 간다.
 */
export type TrashEntry =
	| {
			kind: "doc";
			id: string;
			title: string;
			goal: number;
			path: Path;
			deletedAt: number;
	  }
	| { kind: "folder"; id: string; name: string; path: Path; deletedAt: number };

/**
 * 지금 색인의 판. 옛 판을 읽어 올리는 일은 `model/migrate.ts`에 있다.
 *
 * 2에서 `order`가 생겼다.
 */
export const INDEX_VERSION = 2;

export interface StoreIndex {
	version: typeof INDEX_VERSION;
	folders: FolderEntry[];
	docs: DocEntry[];
	trash: TrashEntry[];
}

export const emptyIndex = (): StoreIndex => ({
	version: INDEX_VERSION,
	folders: [],
	docs: [],
	trash: [],
});
