import type { DocEntry, FolderEntry, StoreIndex, TrashEntry } from "./types";
import { INDEX_VERSION } from "./types";

/**
 * 저장된 색인을 지금 판으로 올린다.
 *
 * 판마다 함수 하나. 읽는 쪽(`api/index-storage.ts`)은 이것만 부르고 어느 판이
 * 어떻게 달랐는지는 알지 않는다.
 */

/** 1판에는 `order`가 없었다 */
interface V1 {
	version: 1;
	folders: Omit<FolderEntry, "order">[];
	docs: Omit<DocEntry, "order">[];
	trash: TrashEntry[];
}

/**
 * 읽어 낸 것이 우리가 아는 색인인가.
 *
 * `docs`가 배열인지만 본다. 나머지 필드는 없으면 빈 배열로 메운다 — 옛 색인에
 * `folders`나 `trash`가 아예 없던 때가 있었고, 그것 때문에 통째로 못 읽는
 * 색인으로 판정하면 멀쩡한 원고를 잃는다.
 */
export function upgradeIndex(parsed: unknown): StoreIndex | null {
	if (typeof parsed !== "object" || parsed === null) return null;
	const raw = parsed as Record<string, unknown>;
	if (!Array.isArray(raw.docs)) return null;

	const shell = {
		folders: Array.isArray(raw.folders) ? raw.folders : [],
		docs: raw.docs,
		trash: Array.isArray(raw.trash) ? raw.trash : [],
	};

	if (raw.version === INDEX_VERSION) {
		return { version: INDEX_VERSION, ...shell } as StoreIndex;
	}
	if (raw.version === 1) return fromV1({ version: 1, ...shell } as V1);

	// 모르는 판이다. 우리보다 새것일 수 있으므로 짐작해서 고치지 않는다
	return null;
}

/**
 * 1 → 2. 없던 `order`를 채운다.
 *
 * **그 판의 화면이 쓰던 정렬 그대로 번호를 매긴다** — 폴더는 이름순, 원고는 최근
 * 수정순. 올린 순간 목록에서 아무것도 움직이지 않아야 한다. 여기서 다른 차례를
 * 주면, 앱을 켰더니 원고들이 뒤바뀌어 있는 꼴이 된다.
 *
 * 자리마다 따로 센다. `order`는 `(path, kind)` 안에서만 뜻이 있다.
 */
function fromV1(old: V1): StoreIndex {
	return {
		version: INDEX_VERSION,
		folders: numberByPath(old.folders, (a, b) =>
			a.name.localeCompare(b.name, "ko"),
		),
		docs: numberByPath(old.docs, (a, b) => b.updatedAt - a.updatedAt),
		trash: old.trash,
	};
}

function numberByPath<T extends { path: string }>(
	entries: T[],
	compare: (a: T, b: T) => number,
): (T & { order: number })[] {
	const groups = new Map<string, T[]>();
	for (const entry of entries) {
		const group = groups.get(entry.path);
		if (group) group.push(entry);
		else groups.set(entry.path, [entry]);
	}

	const order = new Map<T, number>();
	for (const group of groups.values()) {
		group.sort(compare);
		for (const [i, entry] of group.entries()) order.set(entry, i);
	}

	// 저장된 차례는 그대로 두고 번호만 얹는다. 정렬은 읽는 쪽이 한다
	return entries.map((entry) => ({ ...entry, order: order.get(entry) ?? 0 }));
}
