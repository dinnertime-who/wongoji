import { createStore, del, entries, get, set } from "idb-keyval";
import type { DocContent } from "./doc-storage";

/**
 * 아직 서버에 넣지 못한 본문.
 *
 * **이것이 IndexedDB에 남은 유일한 쓰임이다.** 보관함은 서버가 정본이지만,
 * 원고 앱에서 저장 실패 한 번은 문단 하나가 사라지는 일이다 — 메모리에서
 * 다시 시도하는 것으로는 탭이 닫히는 순간을 못 막는다.
 *
 * **정본이 아니다.** 여기 있는 것은 "보냈어야 하는데 못 보낸 것"뿐이고, 보내는
 * 데 성공하면 곧바로 지운다. 읽기가 이곳을 정본으로 삼지 않으므로 서버와 이곳이
 * 갈라져 화해해야 하는 일이 생기지 않는다 — 지금 고치고 있는 버그가 그것이었다.
 *
 * 오프라인으로 쓰는 기능은 아직 아니다. 목록은 서버가 있어야 고칠 수 있다.
 */

const store = createStore("wongoji:outbox", "docs");

interface Pending {
	/**
	 * 누구의 원고인가.
	 *
	 * 계정을 바꿔 로그인하면 앞사람의 미전송 본문이 남아 있을 수 있다. 그것을
	 * 그대로 보내면 **남의 원고를 내 계정에 쓴다.** 보낼 때 임자를 본다.
	 */
	userId: string;
	content: DocContent;
	at: number;
}

/** 지금 로그인한 사람. 앱이 뜰 때와 계정이 바뀔 때 알려 준다 */
let owner: string | null = null;

export function setDocOwner(userId: string | null): void {
	owner = userId;
}

export const docOwner = (): string | null => owner;

/** 실패해도 던지지 않는다. 대기열을 못 써도 서버로 보내는 일은 해 봐야 한다 */
export async function hold(docId: string, content: DocContent): Promise<void> {
	if (!owner) return;
	try {
		await set(docId, { userId: owner, content, at: Date.now() }, store);
	} catch {
		// 사생활 보호 모드처럼 저장소가 아예 없는 환경이다
	}
}

export async function release(docId: string): Promise<void> {
	try {
		await del(docId, store);
	} catch {
		// 지우지 못해도 할 수 있는 일이 없다
	}
}

/** 이 원고의 미전송 본문. 임자가 다르면 없는 것으로 본다 */
export async function pending(docId: string): Promise<DocContent | undefined> {
	if (!owner) return undefined;
	try {
		const held = await get<Pending>(docId, store);
		return held && held.userId === owner ? held.content : undefined;
	} catch {
		return undefined;
	}
}

/** 보내야 할 것들. 앱이 뜰 때와 연결이 돌아왔을 때 훑는다 */
export async function held(): Promise<
	{ docId: string; content: DocContent }[]
> {
	if (!owner) return [];
	try {
		return (await entries<string, Pending>(store))
			.filter(([, v]) => v?.userId === owner)
			.map(([docId, v]) => ({ docId: String(docId), content: v.content }));
	} catch {
		return [];
	}
}
