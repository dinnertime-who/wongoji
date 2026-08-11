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

export interface FolderEntry {
	id: string;
	name: string;
	/** 이 폴더가 놓인 자리. 자기 id는 들어가지 않는다 */
	path: Path;
}

export interface DocEntry {
	id: string;
	title: string;
	path: Path;
	/** 목표 매수. 0이면 목표를 두지 않은 것 */
	goal: number;
	/** 목록에서 보여줄 값 — 문서를 열지 않고도 알 수 있게 색인에 함께 둔다 */
	chars: number;
	sheets: number;
	createdAt: number;
	updatedAt: number;
}

export type TrashEntry =
	| { kind: "doc"; id: string; path: Path; deletedAt: number }
	| { kind: "folder"; id: string; name: string; path: Path; deletedAt: number };

export interface StoreIndex {
	version: 1;
	folders: FolderEntry[];
	docs: DocEntry[];
	trash: TrashEntry[];
}

export const emptyIndex = (): StoreIndex => ({
	version: 1,
	folders: [],
	docs: [],
	trash: [],
});
