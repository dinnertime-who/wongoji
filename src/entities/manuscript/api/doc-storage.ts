import {
	clear,
	createStore,
	del,
	get,
	keys,
	set,
	type UseStore,
} from "idb-keyval";
import {
	currentScope,
	listStorageKeys,
	type SaveResult,
	type StorageScope,
	safeGetItem,
	safeRemoveItem,
	scopedDbName,
} from "#/shared/lib/storage";

/**
 * 원고 본문을 저장소에 넣고 뺀다.
 *
 * **본문만 IndexedDB에 있다. 색인은 localStorage에 그대로다.**
 *
 * 재 보면 원고 200개의 색인은 57KB인데 본문은 6MB가 넘는다 — localStorage의
 * 5MB 상한에 닿는 것은 본문뿐이다. 그리고 색인은 `useSyncExternalStore`가
 * 동기 스냅샷을 요구해서 옮길 수도 없다. 그래서 지금 색인과 본문 키를 나눠 둔
 * 경계가 그대로 저장소 경계가 되었다.
 *
 * 여기 있는 것은 전부 Promise를 돌려준다. IndexedDB가 그렇고 어떤 라이브러리도
 * 그것을 없애지 못한다. 부르는 쪽은 이미 기다릴 자리가 있었다 —
 * `useManuscriptDoc`의 `Load` 상태가 그것이다.
 */

/** 본문 키 앞머리. 옛 localStorage 본문을 찾을 때만 쓴다 */
export const DOC_PREFIX = "wongoji:v1:doc:";

/**
 * 이 칸의 본문이 사는 곳.
 *
 * 칸마다 **데이터베이스**를 따로 연다. store를 따로 여는 편이 자연스러워 보이지만
 * `createStore`가 버전 없이 DB를 열기 때문에 그럴 수 없다 — 이미 있는 DB에는
 * store가 새로 만들어지지 않아 질의가 통째로 실패한다.
 *
 * DB가 갈리면 남의 칸을 훑을 길이 아예 없다. 계정 칸을 치울 때도 DB 하나만
 * 버리면 된다.
 */
let opened: { scope: StorageScope; store: UseStore } | null = null;

function store(): UseStore {
	const scope = currentScope();
	if (!opened || opened.scope !== scope) {
		opened = { scope, store: createStore(scopedDbName(scope), "docs") };
	}
	return opened.store;
}

/** 본문 하나. Tiptap 문서를 그대로 담는다 */
export type DocContent = unknown;

/**
 * 질의 캐시에서 이 본문이 놓이는 자리.
 *
 * 읽는 쪽과 쓴 뒤 캐시를 고치는 쪽이 같은 열쇠를 봐야 한다. 각자 적으면 언젠가
 * 갈라지고, 갈라지면 저장한 내용이 다음에 열 때 옛것으로 되돌아간다.
 */
export const docQueryKey = (id: string) => ["doc", currentScope(), id] as const;

/*
 * 옛 원고를 옮긴다.
 *
 * 쓰던 사람의 본문은 localStorage에 있다. 저장소를 갈면서 그것을 두고 가면
 * 원고가 통째로 사라진 것처럼 보인다.
 *
 * 아래 모든 함수가 이것을 먼저 기다린다. 부르는 쪽이 순서를 맞출 필요가 없고,
 * 한 번만 돌며, 잊을 수가 없다. 실패하면 다음 부름에서 다시 해 본다 —
 * 옮기지 못한 채로 "없다"고 답하는 것이 제일 나쁘다.
 */
let migration: Promise<void> | null = null;

function migrated(): Promise<void> {
	/*
	 * 옛 키(`wongoji:v1:doc:*`)에는 칸이 없다 — 계정이 생기기 전에 쓴 것이므로
	 * 전부 비로그인 원고다. 계정 칸에서 이것을 돌리면 남의 원고를 계정 보관함에
	 * 쏟아 넣는다.
	 */
	if (currentScope() !== null) return Promise.resolve();

	migration ??= migrate().catch((error) => {
		migration = null;
		throw error;
	});
	return migration;
}

async function migrate(): Promise<void> {
	const legacy = listStorageKeys().filter((k) => k.startsWith(DOC_PREFIX));
	if (!legacy.length) return;

	for (const key of legacy) {
		const raw = safeGetItem(key);
		if (raw === null) continue;

		const id = key.slice(DOC_PREFIX.length);
		let content: DocContent;
		try {
			content = JSON.parse(raw);
		} catch {
			/*
			 * 못 읽는 본문도 옮긴다. 문자열 그대로 넣어 두면 `toEditorContent`가
			 * 옛 평문 저장으로 보고 조판해 준다. 여기서 버리면 되살릴 길이 없다.
			 */
			content = raw;
		}

		// 옮긴 것이 확실해진 뒤에 지운다. 순서를 뒤집으면 중간에 끊겼을 때 잃는다
		await set(id, content, store());
		safeRemoveItem(key);
	}
}

/**
 * 실패를 값으로 돌려준다.
 *
 * localStorage 때와 같은 약속이다 — 원고가 이 브라우저에만 있으므로 저장
 * 실패를 삼키면 사용자는 계속 쓰는데 아무것도 남지 않는다. IndexedDB도 상한이
 * 있고(디스크 여유에 따라 다르다) 사생활 보호 모드에서는 열리지 않는다.
 */
function failure(error: unknown): SaveResult {
	const name = error instanceof Error ? error.name : "";
	if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
		return {
			ok: false,
			kind: "quota",
			message:
				"저장 공간이 가득 차 원고가 저장되지 않았습니다. 백업을 받고 필요 없는 원고를 지워 주세요.",
		};
	}
	return {
		ok: false,
		kind: "unavailable",
		message: "원고를 저장하지 못했습니다. 백업을 받아 두세요.",
	};
}

export async function readDoc(id: string): Promise<DocContent | null> {
	try {
		await migrated();
		return (await get<DocContent>(id, store())) ?? null;
	} catch {
		/*
		 * 못 읽은 것과 없는 것을 여기서는 구별하지 않는다. 부르는 쪽은 둘 다
		 * "본문을 잃었다"로 다루고, 그쪽이 하는 일(빈 에디터를 띄우지 않고 알린다)이
		 * 두 경우 모두 맞다.
		 */
		return null;
	}
}

/**
 * 본문이 써졌다고 알린다.
 *
 * 색인이 쓰는 방식과 같다. 동기화가 이것을 듣고 서버로 밀어 넣는데, 저장하는
 * 쪽이 동기화를 알 필요는 없다 — 알게 하면 저장이 로그인 여부에 따라 달라진다.
 */
const written = new Set<(id: string) => void>();

export function subscribeToDocWrites(
	listener: (id: string) => void,
): () => void {
	written.add(listener);
	return () => void written.delete(listener);
}

export async function writeDoc(
	id: string,
	content: DocContent,
): Promise<SaveResult> {
	try {
		await migrated();
		await set(id, content, store());

		for (const listener of written) {
			try {
				listener(id);
			} catch {
				// 듣는 쪽 사정이다. 저장은 이미 끝났다
			}
		}
		return { ok: true };
	} catch (error) {
		return failure(error);
	}
}

export async function removeDoc(id: string): Promise<void> {
	try {
		await migrated();
		await del(id, store());
	} catch {
		// 지우지 못해도 할 수 있는 일이 없다
	}
}

/**
 * 저장소에 본문이 있는 원고 id 전부.
 *
 * 고아를 찾을 때 쓴다. 전에는 localStorage 키를 훑어 앞머리를 떼었는데, 이제
 * store가 본문 전용이라 키가 곧 id다.
 *
 * 실패하면 빈 배열이다 — "하나도 없다"와 구별되지 않지만, 지울 것을 못 찾는
 * 쪽이 잘못 지우는 쪽보다 낫다.
 */
export async function listDocIds(): Promise<string[]> {
	try {
		await migrated();
		return (await keys(store())).map(String);
	} catch {
		return [];
	}
}

/** 이 store의 본문을 전부 버린다. 계정 칸을 치울 때 쓴다 */
export async function clearDocs(): Promise<void> {
	try {
		await clear(store());
	} catch {
		// 지우지 못해도 할 수 있는 일이 없다
	}
}

// ─── 지정한 칸 ───

/**
 * 지금 보고 있는 칸이 아닌 곳의 본문.
 *
 * 로그인 직후 비로그인 원고를 계정으로 올릴 때 쓴다. 옛 본문 옮기기를 거치지
 * 않는다 — 부르는 쪽이 어느 칸인지 알고 부른다.
 */
const storeIn = (scope: StorageScope) =>
	createStore(scopedDbName(scope), "docs");

export async function readDocIn(
	scope: StorageScope,
	id: string,
): Promise<DocContent | null> {
	try {
		return (await get<DocContent>(id, storeIn(scope))) ?? null;
	} catch {
		return null;
	}
}

export async function listDocIdsIn(scope: StorageScope): Promise<string[]> {
	try {
		return (await keys(storeIn(scope))).map(String);
	} catch {
		return [];
	}
}

export async function clearDocsIn(scope: StorageScope): Promise<void> {
	try {
		await clear(storeIn(scope));
	} catch {
		// 지우지 못해도 할 수 있는 일이 없다
	}
}
