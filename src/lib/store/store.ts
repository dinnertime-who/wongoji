import {
	type SaveResult,
	safeGetItem,
	safeRemoveItem,
	safeSetItem,
} from "#/shared/lib/storage";
import { purgeExpired, repairPaths } from "./operations";
import { emptyIndex, type StoreIndex } from "./types";

/**
 * 색인과 본문을 localStorage에 넣고 뺀다.
 *
 * 키를 나눈 이유는 저장 비용이다. 한 덩어리에 다 넣으면 글자 하나 칠 때마다
 * 전체를 다시 쓴다. 원고별로 나누면 그 원고만 쓴다.
 */

export const INDEX_KEY = "wongoji:v1:index";
const LAST_KEY = "wongoji:v1:last";
/** 본문 키 앞머리. 고아를 찾을 때 이 값으로 훑으므로 한 곳에서만 정한다 */
const DOC_PREFIX = "wongoji:v1:doc:";
const docKey = (id: string) => `${DOC_PREFIX}${id}`;

/** 본문 하나. Tiptap 문서를 그대로 담는다 */
export type DocContent = unknown;

function parseIndex(raw: string | null): StoreIndex | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		if (parsed?.version !== 1 || !Array.isArray(parsed.docs)) return null;
		return {
			version: 1,
			folders: parsed.folders ?? [],
			docs: parsed.docs,
			trash: parsed.trash ?? [],
		};
	} catch {
		return null;
	}
}

export function readIndex(): StoreIndex {
	return parseIndex(safeGetItem(INDEX_KEY)) ?? emptyIndex();
}

/**
 * 색인이 있는데 읽어내지 못했는가.
 *
 * `readIndex`는 못 읽으면 빈 색인을 준다 — 그리는 쪽에는 그편이 맞다. 하지만
 * **지우거나 덮어쓰기 전에는 반드시 이것을 물어야 한다.** 빈 색인을 사실로 믿고
 * 이어 가면 고아 정리가 본문 키를 전부 지우고, 그 위에 빈 목록이 써진다.
 */
export function indexUnreadable(): boolean {
	const raw = safeGetItem(INDEX_KEY);
	return raw !== null && parseIndex(raw) === null;
}

const CORRUPT: SaveResult = {
	ok: false,
	kind: "corrupt",
	message:
		"보관함 목록을 읽지 못했습니다. 원고 본문은 그대로 있습니다. 덮어쓰지 않도록 저장을 멈췄습니다 — 백업을 받고 다른 탭을 모두 닫은 뒤 새로고침해 주세요.",
};

/**
 * 색인이 바뀌었다고 알린다.
 *
 * 브라우저는 자기가 쓴 것에 `storage` 이벤트를 주지 않으므로, 같은 탭 안에서는
 * 이쪽으로 알려야 사이드바가 따라온다.
 */
const listeners = new Set<() => void>();

export function subscribeToIndex(listener: () => void): () => void {
	listeners.add(listener);
	return () => void listeners.delete(listener);
}

export function writeIndex(index: StoreIndex): SaveResult {
	const result = safeSetItem(INDEX_KEY, JSON.stringify(index));
	if (!result.ok) return result;

	/*
	 * 구독자 하나가 터져도 나머지에게는 알린다. 여기서 예외가 새어 나가면
	 * 저장은 이미 끝났는데 부르는 쪽은 실패로 받는다 — 실패를 값으로 돌려준다는
	 * 이 층의 약속이 깨진다.
	 */
	for (const listener of listeners) {
		try {
			listener();
		} catch {
			// 구독자 사정이다. 저장 결과와는 무관하다
		}
	}
	return result;
}

/**
 * 색인을 고친다.
 *
 * **반드시 그 자리에서 다시 읽어 고친다.** 탭이 둘이면 색인 키는 하나뿐이라,
 * 메모리에 든 오래된 사본을 통째로 쓰면 다른 탭이 방금 한 일이 사라진다.
 */
export function mutateIndex(change: (index: StoreIndex) => StoreIndex): {
	index: StoreIndex;
	result: SaveResult;
} {
	const index = change(readIndex());
	return { index, result: writeIndex(index) };
}

// ─── 본문 ───

export function readDoc(id: string): DocContent | null {
	const raw = safeGetItem(docKey(id));
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const writeDoc = (id: string, content: DocContent): SaveResult =>
	safeSetItem(docKey(id), JSON.stringify(content));

export const removeDoc = (id: string): void => safeRemoveItem(docKey(id));

// ─── 마지막으로 연 원고 ───

export const readLastOpened = (): string | null => safeGetItem(LAST_KEY);
export const writeLastOpened = (id: string): SaveResult =>
	safeSetItem(LAST_KEY, id);

// ─── 앱을 열 때 한 번 ───

/**
 * 색인을 다듬는다.
 *
 * 1. 기한이 지난 휴지통 항목을 비우고 그 본문 키도 지운다
 * 2. 끊어진 경로를 살아 있는 조상까지 끌어올린다
 * 3. 색인에 없는 본문 키를 지운다 — 용량만 먹는 고아다.
 *    휴지통에 있는 것은 되살릴 본문이므로 건드리지 않는다
 */
export function tidy(now = Date.now()): {
	index: StoreIndex;
	result: SaveResult;
} {
	/*
	 * 색인을 못 읽었으면 아무것도 하지 않는다.
	 *
	 * 이 함수가 하는 일이 전부 "색인에 없는 것을 지운다"라서, 빈 색인을 받으면
	 * 모든 원고의 본문 키가 색인에 없는 것이 되어 통째로 사라진다. 한 바이트만
	 * 깨져도 그렇게 된다. 본문은 그대로 두고 실패만 알린다.
	 */
	if (indexUnreadable()) return { index: emptyIndex(), result: CORRUPT };

	const purged = purgeExpired(readIndex(), now);
	const index = repairPaths(purged.index);
	const result = writeIndex(index);

	/*
	 * 본문은 색인이 실제로 써진 뒤에 지운다. 순서를 뒤집으면 쓰기가 실패했을 때
	 * 색인에는 남아 있는데 본문만 없는 원고가 된다 — 되살릴 길이 없다.
	 */
	if (result.ok) {
		for (const id of purged.removedDocIds) removeDoc(id);
		removeOrphanDocs(index);
	}

	return { index, result };
}

function removeOrphanDocs(index: StoreIndex): void {
	const known = new Set([
		...index.docs.map((d) => d.id),
		...index.trash.filter((t) => t.kind === "doc").map((t) => t.id),
	]);

	for (const key of listKeys()) {
		if (!key.startsWith(DOC_PREFIX)) continue;
		if (!known.has(key.slice(DOC_PREFIX.length))) safeRemoveItem(key);
	}
}

function listKeys(): string[] {
	try {
		return typeof window === "undefined"
			? []
			: Object.keys(window.localStorage);
	} catch {
		return [];
	}
}
