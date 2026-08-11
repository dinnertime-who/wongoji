import {
	type SaveResult,
	safeGetItem,
	safeRemoveItem,
	safeSetItem,
} from "./local";
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
const docKey = (id: string) => `wongoji:v1:doc:${id}`;

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
	if (result.ok) for (const listener of listeners) listener();
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

export const hasDoc = (id: string): boolean => safeGetItem(docKey(id)) !== null;

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
	const purged = purgeExpired(readIndex(), now);
	for (const id of purged.removedDocIds) removeDoc(id);

	const index = repairPaths(purged.index);
	removeOrphanDocs(index);

	return { index, result: writeIndex(index) };
}

function removeOrphanDocs(index: StoreIndex): void {
	const known = new Set([
		...index.docs.map((d) => d.id),
		...index.trash.filter((t) => t.kind === "doc").map((t) => t.id),
	]);

	for (const key of listKeys()) {
		if (!key.startsWith("wongoji:v1:doc:")) continue;
		const id = key.slice("wongoji:v1:doc:".length);
		if (!known.has(id)) safeRemoveItem(key);
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
