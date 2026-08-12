import {
	currentScope,
	type SaveResult,
	type StorageScope,
	safeGetItem,
	safeSetItem,
	scopedKey,
	subscribeToScope,
} from "#/shared/lib/storage";
import { emptyIndex, type StoreIndex } from "../model/types";

/**
 * 색인을 저장소에 넣고 뺀다.
 *
 * **회원 기능이 갈아끼울 지점이 여기다.** 이 파일 밖에서는 아무도 저장소를
 * 직접 만지지 않으므로, 서버 구현을 넣을 때 고칠 곳이 이 한 벌이다.
 *
 * 색인과 본문을 다른 키에 둔 이유는 저장 비용이다. 한 덩어리에 다 넣으면 글자
 * 하나 칠 때마다 전체를 다시 쓴다. 본문은 원고별로 따로 있고 여기서 다루지 않는다.
 */

/**
 * 색인이 놓이는 키. **상수가 아니라 물어봐야 하는 값이다.**
 *
 * 로그인하면 계정 칸으로 자리가 옮겨진다. 상수로 두면 계정 원고가 비로그인
 * 원고 위에 써진다.
 */
export const indexKey = () => scopedKey("index");
const lastKey = () => scopedKey("last");

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

/*
 * 마지막으로 읽은 것을 붙들어 둔다.
 *
 * 화면이 이 스냅샷을 구독하는데, 그릴 때마다 새 객체를 주면 그 자체가 다시
 * 그릴 이유가 되어 멈추지 않는다. 원본 문자열이 그대로면 같은 객체를 돌려준다 —
 * 다시 파싱하지도 않는다.
 */
let snapshotRaw: string | null | undefined;
let snapshot: StoreIndex = emptyIndex();
/*
 * 스냅샷이 어느 칸의 것인지 함께 붙든다. 칸이 갈리면 원본 문자열이 우연히 같을
 * 수 있는데(둘 다 빈 색인이면 실제로 같다), 그때 옛 객체를 그대로 돌려주면
 * 화면은 보관함이 바뀐 것을 모른다.
 */
let snapshotScope: StorageScope | undefined;

/** 지금 색인. 바뀌지 않았으면 지난번과 같은 객체다 */
export function indexSnapshot(): StoreIndex {
	const scope = currentScope();
	const raw = safeGetItem(indexKey());
	if (raw !== snapshotRaw || scope !== snapshotScope) {
		snapshotRaw = raw;
		snapshotScope = scope;
		snapshot = parseIndex(raw) ?? emptyIndex();
	}
	return snapshot;
}

/** 지금 색인. 못 읽으면 빈 색인이다 */
export function readIndex(): StoreIndex {
	return parseIndex(safeGetItem(indexKey())) ?? emptyIndex();
}

/**
 * 색인이 있는데 읽어내지 못했는가.
 *
 * `readIndex`는 못 읽으면 빈 색인을 준다 — 그리는 쪽에는 그편이 맞다. 하지만
 * **지우거나 덮어쓰기 전에는 반드시 이것을 물어야 한다.** 빈 색인을 사실로 믿고
 * 이어 가면 고아 정리가 본문 키를 전부 지우고, 그 위에 빈 목록이 써진다.
 */
export function indexUnreadable(): boolean {
	const raw = safeGetItem(indexKey());
	return raw !== null && parseIndex(raw) === null;
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

/*
 * 칸이 갈리면 색인이 바뀐 것과 같다 — 보던 자리가 통째로 옮겨졌다.
 *
 * `storage` 이벤트로는 오지 않는다. 값이 바뀐 것이 아니라 어느 키를 볼지가
 * 바뀐 것이라 브라우저가 알려 줄 수가 없다.
 */
subscribeToScope(() => {
	for (const listener of listeners) {
		try {
			listener();
		} catch {
			// 구독자 사정이다
		}
	}
});

export function writeIndex(index: StoreIndex): SaveResult {
	const json = JSON.stringify(index);
	const result = safeSetItem(indexKey(), json);
	if (!result.ok) return result;

	// 방금 쓴 것을 스냅샷으로 삼는다. 다시 읽어 파싱할 이유가 없다
	snapshotRaw = json;
	snapshot = index;
	snapshotScope = currentScope();

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

// ─── 마지막으로 연 원고 ───

export const readLastOpened = (): string | null => safeGetItem(lastKey());
export const writeLastOpened = (id: string): SaveResult =>
	safeSetItem(lastKey(), id);
