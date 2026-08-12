import {
	emptyIndex,
	indexUnreadable,
	purgeExpired,
	readIndex,
	repairPaths,
	type StoreIndex,
	writeIndex,
} from "#/entities/archive";
import { listDocIds, removeDoc } from "#/entities/manuscript";
import type { SaveResult } from "#/shared/lib/storage";

/**
 * 앱을 열 때 색인을 다듬는다.
 *
 * 1. 기한이 지난 휴지통 항목을 비우고 그 본문 키도 지운다
 * 2. 끊어진 경로를 살아 있는 조상까지 끌어올린다
 * 3. 색인에 없는 본문 키를 지운다 — 용량만 먹는 고아다.
 *    휴지통에 있는 것은 되살릴 본문이므로 건드리지 않는다
 *
 * **이것이 feature인 이유**는 두 entity를 함께 봐야 하기 때문이다. 색인이
 * 무엇을 알고 있는지(archive)와 본문 키가 무엇이 있는지(manuscript)를 맞대어
 * 보는 일이라, 둘 중 어느 쪽에 두어도 다른 쪽을 가로질러 불러야 한다.
 */

const CORRUPT: SaveResult = {
	ok: false,
	kind: "corrupt",
	message:
		"보관함 목록을 읽지 못했습니다. 원고 본문은 그대로 있습니다. 덮어쓰지 않도록 저장을 멈췄습니다 — 백업을 받고 다른 탭을 모두 닫은 뒤 새로고침해 주세요.",
};

export async function tidy(now = Date.now()): Promise<{
	index: StoreIndex;
	result: SaveResult;
}> {
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
		for (const id of purged.removedDocIds) await removeDoc(id);
		await removeOrphanDocs(index);
	}

	return { index, result };
}

/**
 * 색인에 없는 본문을 지운다.
 *
 * 전에는 localStorage 키를 전부 훑어 앞머리를 떼어 냈다. 이제 본문이 저희들만
 * 쓰는 IndexedDB store에 있어서 키가 곧 원고 id다 — 남의 칸을 볼 길이 없다.
 */
async function removeOrphanDocs(index: StoreIndex): Promise<void> {
	const known = new Set([
		...index.docs.map((d) => d.id),
		...index.trash.filter((t) => t.kind === "doc").map((t) => t.id),
	]);

	for (const id of await listDocIds()) {
		if (!known.has(id)) await removeDoc(id);
	}
}
