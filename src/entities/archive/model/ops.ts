import type { DocStatus } from "../config/status";
import {
	createDoc,
	createFolder,
	duplicateDoc,
	type Moving,
	makeId,
	nudgeEntry,
	type Placement,
	placeEntry,
	purge,
	renameFolder,
	restore,
	trashDoc,
	trashFolder,
	updateDoc,
} from "./operations";
import type { DocEntry, Path, StoreIndex } from "./types";

/**
 * 보관함에 가할 수 있는 일 한 가지.
 *
 * **색인 전체를 주고받지 않으려고 둔다.** 전에는 브라우저가 고친 색인을 통째로
 * 밀어 넣었는데, 그러면 나중에 보낸 쪽이 이긴다 — 탭이 둘이면 서로의 일을
 * 지우고, 무엇보다 **빠진 것을 지운 것으로 볼 수가 없다.** 완전히 삭제한 원고가
 * 새로고침하면 되살아나던 것이 그래서였다.
 *
 * 무엇이 바뀌었는지가 아니라 **무엇을 했는지**를 보낸다. 지운 것은 지웠다고
 * 적히므로 서버가 알아맞힐 필요가 없다.
 *
 * 종류는 `operations.ts`의 내보내기와 짝이 맞는다. 새 연산을 만들 때 그쪽에
 * 순수 함수를 두고 여기 한 줄을 늘리면 된다 — 로직은 한 벌뿐이다.
 */
export type ArchiveOp =
	| { kind: "createDoc"; path: Path; title?: string }
	| { kind: "createFolder"; name: string; path: Path }
	| { kind: "duplicateDoc"; id: string }
	| { kind: "updateDoc"; id: string; patch: DocPatch; touch?: boolean }
	| { kind: "renameFolder"; id: string; name: string }
	| { kind: "placeEntry"; moving: Moving; to: Placement }
	| { kind: "nudgeEntry"; moving: Moving; dir: -1 | 1 }
	| { kind: "trashDoc"; id: string }
	| { kind: "trashFolder"; id: string }
	| { kind: "restore"; id: string }
	| { kind: "purge"; ids: string[] }
	| { kind: "purgeAll" };

/**
 * 원고 줄에서 고칠 수 있는 값.
 *
 * `path`와 `order`는 여기 없다 — 자리를 옮기는 것은 `placeEntry`의 일이고, 그쪽은
 * 형제들의 번호까지 함께 매긴다. 두 길을 열어 두면 순서를 잊고 옮기는 길이 생긴다.
 */
export type DocPatch = Partial<
	Pick<DocEntry, "title" | "goal" | "chars" | "sheets">
> & {
	/** 진행 상태. `null`을 보내면 라벨을 뗀다 */
	status?: DocStatus | null;
};

/**
 * 연산이 남긴 것.
 *
 * 색인 말고 **본문에 해야 할 일**을 함께 알린다. `operations.ts`는 본문 키를
 * 모르는 순수 함수라 그것까지 할 수 없고, 그렇다고 부르는 쪽이 연산마다 "이때는
 * 본문도 지워야지"를 각자 기억하면 반드시 한 곳이 빠진다 — 실제로 빠져 있었다.
 */
export interface OpEffect {
	index: StoreIndex;
	/** 새로 생긴 원고. 본문을 만들어 주어야 한다 */
	createdDocId?: string;
	/** 복제의 원본. 그 본문을 새 id로 베껴야 한다 */
	copiedFrom?: string;
	/** 색인에서 영영 빠진 원고. 본문도 함께 지운다 */
	removedDocIds: string[];
}

/** 시각과 id를 밖에서 받는다. 서버와 브라우저가 같은 함수를 다르게 부를 수 있게 */
export interface OpContext {
	now?: number;
	newId?: () => string;
}

/**
 * 연산 하나를 색인에 적용한다. **서버와 브라우저가 같은 이 함수를 부른다.**
 *
 * 서버는 정본을 고치려고, 브라우저는 응답을 기다리는 동안 화면을 미리 고쳐
 * 두려고 부른다. 같은 함수라 **낙관적으로 그린 결과와 서버가 돌려준 결과가
 * 어긋날 수 없다** — 낙관적 갱신에서 가장 자주 나는 어긋남이 여기서 없어진다.
 *
 * 대상이 없는 연산은 색인을 그대로 돌려준다. 사라진 원고에 대고 누른 것이라
 * 실패로 다룰 것이 없다.
 */
export function applyOp(
	index: StoreIndex,
	op: ArchiveOp,
	{ now = Date.now(), newId = makeId }: OpContext = {},
): OpEffect {
	switch (op.kind) {
		case "createDoc": {
			const made = createDoc(
				index,
				{ title: op.title ?? "", path: op.path, now },
				newId,
			);
			return {
				index: made.index,
				createdDocId: made.doc.id,
				removedDocIds: [],
			};
		}

		case "createFolder":
			return {
				index: createFolder(index, op.name, op.path, newId).index,
				removedDocIds: [],
			};

		case "duplicateDoc": {
			const made = duplicateDoc(index, op.id, now, newId);
			if (!made) return { index, removedDocIds: [] };
			return {
				index: made.index,
				createdDocId: made.doc.id,
				copiedFrom: op.id,
				removedDocIds: [],
			};
		}

		case "updateDoc": {
			/*
			 * `touch: false`는 "고쳤다고 치지 말라"는 뜻이다.
			 *
			 * 되살린 원고를 열 때 분량을 다시 세어 적는데, 그때 수정 시각까지
			 * 올리면 읽기만 한 원고가 목록 맨 위로 올라온다 — "최근 수정순"이
			 * 거짓말이 된다.
			 */
			const entry = index.docs.find((d) => d.id === op.id);
			const at = op.touch === false && entry ? entry.updatedAt : now;

			/*
			 * 상태가 바뀌면 그때를 함께 적는다. **`statusAt`은 보낸 값을 쓰지
			 * 않는다** — 언제 그 상태가 되었는지는 고치는 쪽이 정할 값이 아니다.
			 */
			const patch =
				op.patch.status !== undefined && op.patch.status !== entry?.status
					? { ...op.patch, statusAt: now }
					: op.patch;

			return {
				index: updateDoc(index, op.id, patch, at),
				removedDocIds: [],
			};
		}

		case "renameFolder":
			return { index: renameFolder(index, op.id, op.name), removedDocIds: [] };

		case "placeEntry":
			return { index: placeEntry(index, op.moving, op.to), removedDocIds: [] };

		case "nudgeEntry":
			return { index: nudgeEntry(index, op.moving, op.dir), removedDocIds: [] };

		case "trashDoc":
			return { index: trashDoc(index, op.id, now), removedDocIds: [] };

		case "trashFolder":
			return { index: trashFolder(index, op.id, now), removedDocIds: [] };

		case "restore":
			return { index: restore(index, op.id), removedDocIds: [] };

		case "purge":
			return purge(index, op.ids);

		/*
		 * 휴지통을 통째로 비운다. 폴더 아래 것들이 함께 가는 규칙은 `purge`가
		 * 이미 알고 있으므로, 들고 있는 id를 전부 넘기면 그만이다.
		 */
		case "purgeAll":
			return purge(
				index,
				index.trash.map((t) => t.id),
			);
	}
}
