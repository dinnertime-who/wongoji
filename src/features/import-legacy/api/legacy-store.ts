import { clear, createStore, entries, get } from "idb-keyval";
import { emptyIndex, type StoreIndex, upgradeIndex } from "#/entities/archive";
import type { DocContent } from "#/entities/manuscript";
import { safeGetItem, safeRemoveItem } from "#/shared/lib/storage";

/**
 * 로그인이 없던 시절의 저장소.
 *
 * **읽고 지우기만 한다.** 여기에 새로 쓰는 코드는 없다 — 이 브라우저에 남아
 * 있는 원고를 계정으로 한 번 옮기고 나면 이 파일은 함께 사라진다.
 *
 * 칸(scope)을 따지지 않는다. 옮길 것은 비로그인 칸 하나뿐이고, 계정 칸에 있던
 * 것은 이미 서버에 올라가 있다 — 그쪽이 정본이 되었으므로 브라우저의 사본은
 * 읽을 값이 없다.
 */

/** 비로그인 시절 본문이 살던 곳 */
const legacy = createStore("wongoji", "docs");

/** 비로그인 시절 목록이 살던 키. 계정 칸(`…:u:<id>:index`)은 보지 않는다 */
const INDEX = "wongoji:v1:index";
const LAST = "wongoji:v1:last";

/**
 * 옛 목록.
 *
 * 옛 판(1판)이면 올려서 준다 — 그때 `order`가 없었다. 올린 결과를 도로 적지는
 * 않는다. 어차피 계정으로 옮기고 나면 이 키는 지워진다.
 */
export function readLegacyIndex(): StoreIndex {
	const raw = safeGetItem(INDEX);
	if (!raw) return emptyIndex();
	try {
		return upgradeIndex(JSON.parse(raw)) ?? emptyIndex();
	} catch {
		return emptyIndex();
	}
}

/**
 * 옛 본문 하나.
 *
 * 두 군데를 본다. IndexedDB로 옮기기 전에는 본문이 localStorage에
 * `wongoji:v1:doc:<id>`로 있었고, 그 뒤로 앱을 한 번도 열지 않은 브라우저에는
 * 아직 거기 남아 있다. **옮기지 못한 원고를 두고 가는 것이 여기서 제일 나쁜
 * 결과**라 값싼 쪽을 한 번 더 본다.
 */
export async function readLegacyDoc(id: string): Promise<DocContent | null> {
	try {
		const stored = await get<DocContent>(id, legacy);
		if (stored !== undefined) return stored;
	} catch {
		// 저장소를 못 열었다. 아래 옛 키라도 본다
	}

	const raw = safeGetItem(`wongoji:v1:doc:${id}`);
	if (raw === null) return null;
	try {
		return JSON.parse(raw);
	} catch {
		// 못 읽는 본문도 그대로 올린다. 문자열이면 옛 평문 저장이라 읽는 쪽이 가린다
		return raw;
	}
}

/**
 * 계정 칸에 남은 본문들.
 *
 * 서버가 정본이 되기 전에는 계정 원고의 본문도 이 브라우저에 있었다
 * (IndexedDB `wongoji:u:<계정>`). 그것을 서버로 밀어 넣는 일은 뒤에서 돌았고,
 * **끝까지 가지 못한 것이 있다** — 실제로 열어 보니 색인은 서버에 있는데 본문은
 * 404인 원고가 있었다. 그대로 두면 사용자에게는 원고가 통째로 사라진 것이다.
 */
export async function listAccountBodies(
	userId: string,
): Promise<{ id: string; content: DocContent }[]> {
	try {
		const store = createStore(`wongoji:u:${userId}`, "docs");
		return (await entries<string, DocContent>(store)).map(([id, content]) => ({
			id: String(id),
			content,
		}));
	} catch {
		return [];
	}
}

/** 다 옮긴 뒤에 비운다. 남겨 두면 사본이 둘이 되고 그때부터 갈라진다 */
export async function clearLegacy(): Promise<void> {
	safeRemoveItem(INDEX);
	safeRemoveItem(LAST);
	try {
		await clear(legacy);
	} catch {
		// 지우지 못해도 계정에는 다 있다
	}
}
