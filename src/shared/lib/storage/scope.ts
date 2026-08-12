import { safeGetItem, safeSetItem } from "./local";

/**
 * 보관함이 놓이는 칸.
 *
 * 비로그인과 계정이 같은 자리를 쓰면, 로그인해서 계정 원고를 받아 오는 순간
 * 원래 있던 원고를 덮어쓴다. 칸을 갈라 두면 서로 모른 채로 있을 수 있고,
 * 로그아웃해도 쓰던 원고가 그대로 남는다.
 *
 * - 비로그인 `wongoji:v1:index`      · IndexedDB `wongoji`
 * - 계정     `wongoji:v1:u:<id>:index` · IndexedDB `wongoji:u:<id>`
 *
 * 두 접두사는 서로의 접두사가 아니다. 고아 정리가 저장소를 훑으며 "색인에 없는
 * 본문"을 지우므로, 한쪽이 다른 쪽의 접두사이면 로그인하는 순간 비로그인 원고가
 * 통째로 지워진다.
 */

/** 계정 id, 또는 비로그인 */
export type StorageScope = string | null;

/**
 * 마지막으로 알던 칸.
 *
 * 세션은 물어봐야 알 수 있어서 첫 그림에는 늦다. 그때 비로그인 칸부터 열면
 * 로그인한 사람이 남의 보관함을 잠깐 보고, 그 사이에 보관함 세우기가 엉뚱한
 * 칸에 원고를 만든다. 지난번 칸을 적어 두고 그것으로 시작한 뒤, 세션이 도착해
 * 다르면 그때 옮긴다.
 *
 * 이 키만은 칸에 들어가지 않는다 — 어느 칸인지 정하는 값이라 그럴 수 없다.
 */
const SCOPE_KEY = "wongoji:v1:scope";

let current: StorageScope = null;
let restored = false;

const listeners = new Set<() => void>();

/**
 * 처음 물어볼 때 지난번 칸을 되살린다.
 *
 * 훅으로 하면 늦다 — effect는 자식이 먼저 돌아서, 보관함을 세우는 쪽(HomePage)이
 * 칸을 정하는 쪽(root)보다 앞선다. 그러면 로그인한 사람의 원고가 비로그인 칸에
 * 만들어진다. 묻는 순간 스스로 챙기게 해 두면 순서를 맞출 일이 없다.
 *
 * 서버에서는 저장소가 없어 아무것도 하지 않는다. 그쪽은 어차피 빈 색인으로
 * 그린다(`useStoreIndex`의 서버 스냅샷).
 */
function ensureRestored(): void {
	if (restored || typeof window === "undefined") return;
	restored = true;
	const saved = safeGetItem(SCOPE_KEY);
	current = saved ? saved : null;
}

/** 지금 칸 */
export function currentScope(): StorageScope {
	ensureRestored();
	return current;
}

/** 이 칸에서 쓸 localStorage 키 */
export function scopedKey(suffix: string): string {
	ensureRestored();
	return current === null
		? `wongoji:v1:${suffix}`
		: `wongoji:v1:u:${current}:${suffix}`;
}

/** 이 칸의 본문이 사는 IndexedDB 이름 */
export function scopedDbName(scope: StorageScope = currentScope()): string {
	return scope === null ? "wongoji" : `wongoji:u:${scope}`;
}

/**
 * 칸이 바뀌었다고 알린다.
 *
 * 색인을 보고 있는 화면이 이것을 듣고 다시 읽는다. 저장소 키가 통째로 갈리는
 * 것이라 `storage` 이벤트로는 오지 않는다 — 값이 바뀐 것이 아니라 보는 자리가
 * 바뀐 것이다.
 */
export function subscribeToScope(listener: () => void): () => void {
	listeners.add(listener);
	return () => void listeners.delete(listener);
}

export function setStorageScope(next: StorageScope): void {
	ensureRestored();
	if (next === current) return;
	current = next;
	safeSetItem(SCOPE_KEY, next ?? "");

	for (const listener of listeners) {
		try {
			listener();
		} catch {
			// 듣는 쪽 사정이다
		}
	}
}

/**
 * 지난번 칸으로 시작한다. 세션이 도착하기 전에 한 번 부른다.
 *
 * 틀릴 수 있다 — 다른 곳에서 로그아웃했을 수 있다. 세션이 도착하면
 * `setStorageScope`가 바로잡는다. 틀린 칸을 잠깐 보는 것이, 맞는 칸을 볼 때까지
 * 빈 화면을 보는 것보다 낫다.
 */
export function restoreStorageScope(): StorageScope {
	restored = false;
	ensureRestored();
	return current;
}
