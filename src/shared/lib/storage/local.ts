/**
 * localStorage를 다루는 얇은 층.
 *
 * 원고는 이 브라우저에만 있고 서버 사본이 없다. 그래서 저장이 실패했을 때
 * 조용히 넘어가면 사용자는 계속 쓰는데 아무것도 남지 않는다. 실패를 반드시
 * 값으로 돌려주고 부르는 쪽이 화면에 알리게 한다.
 */

export type SaveFailure =
	/** 5MB 상한에 닿았다 */
	| { kind: "quota"; message: string }
	/** 사생활 보호 모드 등으로 저장소 자체를 쓸 수 없다 */
	| { kind: "unavailable"; message: string }
	/**
	 * 색인이 있는데 읽어내지 못했다.
	 *
	 * 읽기 실패지만 저장 실패로 다룬다. 읽지 못한 색인 위에 쓰면 목록을 통째로
	 * 덮어쓰기 때문에, 이 상태에서 우리가 하는 일은 "쓰지 않는 것"이다.
	 * 부르는 쪽은 다른 실패와 똑같이 배너로 알리면 된다.
	 */
	| { kind: "corrupt"; message: string };

export type SaveResult = { ok: true } | ({ ok: false } & SaveFailure);

const OK: SaveResult = { ok: true };

/** 저장소가 아예 없거나 접근이 막힌 환경이 있다 (사생활 보호 모드, 쿠키 차단) */
function getStore(storage?: Storage): Storage | null {
	if (storage) return storage;
	try {
		return typeof window === "undefined" ? null : window.localStorage;
	} catch {
		return null;
	}
}

/**
 * 브라우저마다 상한을 넘겼을 때 던지는 이름이 다르다.
 * 이름 대신 코드를 함께 본다 — Firefox는 `NS_ERROR_DOM_QUOTA_REACHED`를 쓴다.
 */
function isQuotaError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const code = (error as DOMException).code;
	return (
		error.name === "QuotaExceededError" ||
		error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
		code === 22 ||
		code === 1014
	);
}

export function safeSetItem(
	key: string,
	value: string,
	storage?: Storage,
): SaveResult {
	const store = getStore(storage);
	if (!store) {
		return {
			ok: false,
			kind: "unavailable",
			message:
				"이 브라우저에서는 저장소를 쓸 수 없습니다. 사생활 보호 모드라면 일반 창에서 열어 주세요.",
		};
	}

	try {
		store.setItem(key, value);
		return OK;
	} catch (error) {
		if (isQuotaError(error)) {
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
}

export function safeGetItem(key: string, storage?: Storage): string | null {
	const store = getStore(storage);
	if (!store) return null;
	try {
		return store.getItem(key);
	} catch {
		return null;
	}
}

export function safeRemoveItem(key: string, storage?: Storage): void {
	const store = getStore(storage);
	if (!store) return;
	try {
		store.removeItem(key);
	} catch {
		// 지우지 못해도 할 수 있는 일이 없다
	}
}

/**
 * 저장소를 "지속"으로 표시해 달라고 요청한다.
 *
 * 허용되면 용량이 부족할 때 브라우저가 이 출처의 저장소를 먼저 지우지 않는다.
 * 서버 사본이 없는 구조에서는 용량보다 이쪽이 중요하다.
 *
 * 이미 지속이거나 브라우저가 지원하지 않으면 아무 일도 하지 않는다.
 * 거절되어도 사용자를 귀찮게 하지 않는다 — 알릴 만한 조치가 없다.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
	if (typeof navigator === "undefined" || !navigator.storage?.persist) {
		return null;
	}
	try {
		if (await navigator.storage.persisted?.()) return true;
		return await navigator.storage.persist();
	} catch {
		return null;
	}
}
