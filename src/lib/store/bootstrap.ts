import { type SaveResult, safeGetItem } from "./local";
import { createDoc } from "./operations";
import {
	type DocContent,
	readIndex,
	readLastOpened,
	tidy,
	writeDoc,
	writeIndex,
} from "./store";
import type { StoreIndex } from "./types";

/**
 * 앱이 뜰 때 한 번 — 보관함을 쓸 수 있는 상태로 만든다.
 *
 * 1. 색인을 다듬는다 (기한 지난 휴지통 비우기, 끊어진 경로 고치기, 고아 본문 지우기)
 * 2. 원고가 하나도 없으면 옛 원고를 옮겨 오거나, 없으면 새로 만든다
 * 3. 열 원고를 고른다
 */

/**
 * 처음 오는 사람이 보게 될 원고.
 *
 * 빈 화면보다 낫다 — 조판이 어떻게 되는지, 대화가 어떻게 들어가는지 한눈에
 * 보인다. 평문으로 넣으면 읽는 쪽에서 문단으로 나눈다.
 */
const WELCOME = `가을이 깊었다. 마당의 감나무가 잎을 다 떨구고 나서야 나는 그 사실을 알아차렸다.
"올해도 감은 안 열리려나?" 어머니가 물으셨다.
나는 대답 대신 하늘을 올려다보았다. 2024년의 마지막 가을이 그렇게 지나가고 있었다……`;

/** 새 구조 이전에 쓰던 키들 */
const LEGACY = {
	draft: "wongoji:draft",
	title: "wongoji:title",
	goal: "wongoji:goal",
} as const;

export interface Bootstrap {
	index: StoreIndex;
	/** 열어야 할 원고 */
	docId: string;
	/** 옛 원고를 옮겨 왔는가 */
	migrated: boolean;
	result: SaveResult;
}

export function bootstrap(now = Date.now()): Bootstrap {
	const tidied = tidy(now);
	let index = tidied.index;
	let migrated = false;

	if (index.docs.length === 0) {
		const legacy = readLegacy();
		const created = createDoc(index, {
			title: legacy?.title ?? "",
			now,
		});
		index = created.index;

		/*
		 * 본문을 반드시 써 둔다. 색인에만 있고 본문 키가 없는 원고는 "본문을 잃었다"는
		 * 뜻으로 읽히므로, 갓 만든 원고가 그렇게 보여서는 안 된다.
		 */
		if (legacy) {
			// 옛 값을 그대로 옮긴다. 평문이든 Tiptap 문서든 읽는 쪽이 가린다.
			writeDoc(created.doc.id, legacy.content);
			if (legacy.goal > 0) {
				index = {
					...index,
					docs: index.docs.map((d) =>
						d.id === created.doc.id ? { ...d, goal: legacy.goal } : d,
					),
				};
			}
			migrated = true;
		} else {
			writeDoc(created.doc.id, WELCOME);
		}
	}

	return {
		index,
		docId: pickDoc(index),
		migrated,
		result: writeIndex(index),
	};
}

/**
 * 옛 키에서 원고를 읽는다.
 *
 * **읽기만 하고 지우지 않는다.** 서버 사본이 없는 마당에 되돌릴 길을 스스로 없앨
 * 이유가 없다. 한동안 두었다가 나중에 정리한다.
 */
function readLegacy(): {
	content: DocContent;
	title: string;
	goal: number;
} | null {
	const raw = safeGetItem(LEGACY.draft);
	if (!raw) return null;

	let content: DocContent = raw;
	try {
		const parsed = JSON.parse(raw);
		if (parsed?.type === "doc") content = parsed;
	} catch {
		// 평문이었다는 뜻이다. 그대로 넘긴다
	}

	return {
		content,
		title: safeGetItem(LEGACY.title) ?? "",
		goal: Number(safeGetItem(LEGACY.goal)) || 0,
	};
}

/** 마지막으로 열었던 것. 사라졌으면 가장 최근에 고친 것 */
function pickDoc(index: StoreIndex): string {
	const last = readLastOpened();
	if (last && index.docs.some((d) => d.id === last)) return last;

	const recent = [...index.docs].sort((a, b) => b.updatedAt - a.updatedAt)[0];
	return recent?.id ?? "";
}

/** 옛 원고가 남아 있는가 — 나중에 정리할 때 본다 */
export const hasLegacyDraft = (): boolean => safeGetItem(LEGACY.draft) !== null;

/** 지금 색인을 그대로 읽되 다듬지는 않는다 */
export { readIndex };
