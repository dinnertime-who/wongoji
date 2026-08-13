import type { ArchiveOp } from "../model/ops";
import type { StoreIndex } from "../model/types";

/**
 * 계정 보관함과 주고받는 길.
 *
 * **읽는 곳도 쓰는 곳도 서버다.** 전에는 이 자리에 localStorage를 다루는 층이
 * 있었고 서버는 뒤에서 맞추는 사본이었는데, 양쪽이 각자 쓸 수 있는 사본을 들고
 * 화해할 규칙이 없어서 완전히 지운 원고가 새로고침하면 되살아났다.
 *
 * 서버 코드를 직접 부르지 않는다 — `#/server`는 화면 쪽에서 막혀 있고, 막혀
 * 있어야 한다. `cloudflare:workers`가 브라우저 번들에 실리면 빌드가 깨진다.
 */

/** 질의 캐시에서 보관함이 놓이는 자리 */
export const ARCHIVE_KEY = ["archive"] as const;

export interface OpResult {
	index: StoreIndex;
	/** 만드는 연산이었으면 서버가 정한 id */
	createdDocId?: string;
}

async function json<T>(response: Response): Promise<T> {
	if (!response.ok) {
		throw new Error(`보관함 서버가 ${response.status}로 답했습니다`);
	}
	return (await response.json()) as T;
}

export async function fetchArchive(): Promise<StoreIndex> {
	return json<StoreIndex>(await fetch("/api/archive"));
}

/**
 * 무엇을 했는지 알리고, 바뀐 뒤의 보관함을 받는다.
 *
 * 색인 전체를 밀어 넣지 않는 이유는 그 길로는 **지운 것을 알릴 수 없기**
 * 때문이다. 빠진 것이 "지웠다"인지 "이 기기에는 없다"인지 서버가 구별할 방법이
 * 없다.
 */
export async function sendOp(op: ArchiveOp): Promise<OpResult> {
	return json<OpResult>(
		await fetch("/api/archive/ops", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(op),
		}),
	);
}
