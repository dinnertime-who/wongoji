import type { SaveResult } from "#/shared/lib/storage";
import { held, hold, pending, release, setDocOwner } from "./outbox";

/**
 * 원고 본문을 넣고 뺀다. **정본은 서버다.**
 *
 * 전에는 본문이 이 브라우저의 IndexedDB에 있고 서버는 뒤에서 맞추는 사본이었다.
 * 양쪽 다 쓸 수 있는데 화해할 규칙이 없어서, 완전히 지운 원고가 새로고침하면
 * 되살아났다. 읽는 곳을 한 곳으로 모으면 그 종류의 버그가 생길 자리가 없다.
 *
 * IndexedDB는 **미전송 대기열로만** 남았다(`outbox.ts`). 원고 앱에서 저장 실패
 * 한 번은 문단 하나가 사라지는 일이라, 서버에 넣기 전에 반드시 이 브라우저에도
 * 한 벌 둔다. 넣는 데 성공하면 곧바로 지운다.
 *
 * 목록(색인)과 나눠 둔 이유는 그대로다. 목록을 그릴 때 본문이 딸려 오면 원고
 * 수만큼 무거워진다.
 */

/** 본문 하나. Tiptap 문서를 그대로 담는다 */
export type DocContent = unknown;

/**
 * 질의 캐시에서 이 본문이 놓이는 자리.
 *
 * 칸(scope)이 빠졌다. 계정 보관함이 브라우저에 살지 않으므로 한 브라우저에서
 * 두 사람의 본문이 같은 캐시에 놓일 일이 없다 — 계정이 바뀌면 세션이 바뀌고,
 * 그때 캐시는 통째로 버려진다.
 */
export const docQueryKey = (id: string) => ["doc", id] as const;

export { setDocOwner };

const url = (id: string) => `/api/archive/doc/${encodeURIComponent(id)}`;

/**
 * 본문을 읽는다.
 *
 * **미전송 대기열을 먼저 본다.** 못 보낸 것이 있으면 그것이 서버 것보다 새롭다 —
 * 저장에 실패한 채로 새로고침한 사람에게 옛 글을 보여 주면 그 위에 다시 쓰게 된다.
 *
 * 없는 것(404)은 null이다. **못 읽은 것은 던진다** — 둘을 뭉뚱그리면 연결이
 * 잠깐 끊겼을 때 화면이 "본문을 찾을 수 없습니다"를 띄우고, 거기서 "빈 원고로
 * 시작"을 누르면 멀쩡한 원고를 덮어쓴다.
 */
export async function readDoc(id: string): Promise<DocContent | null> {
	const unsent = await pending(id);
	if (unsent !== undefined) return unsent;

	const response = await fetch(url(id));
	if (response.status === 404) return null;
	if (!response.ok) {
		throw new Error(`본문 서버가 ${response.status}로 답했습니다`);
	}
	const { content } = (await response.json()) as { content: DocContent };
	return content;
}

/**
 * 본문을 저장한다. 실패를 값으로 돌려준다.
 *
 * **대기열에 먼저 넣고 보낸다.** 순서를 뒤집으면 보내다 끊긴 글이 어디에도 남지
 * 않는다. 성공하면 대기열에서 뺀다.
 */
export async function writeDoc(
	id: string,
	content: DocContent,
): Promise<SaveResult> {
	await hold(id, content);

	try {
		const response = await fetch(url(id), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		});
		if (!response.ok) throw new Error(String(response.status));

		await release(id);
		return { ok: true };
	} catch {
		return {
			ok: false,
			kind: "offline",
			message:
				"원고를 계정에 저장하지 못했습니다. 이 브라우저에 두었다가 연결되면 다시 보냅니다.",
		};
	}
}

/**
 * 못 보낸 것들을 다시 보낸다. 앱이 뜰 때와 연결이 돌아왔을 때.
 *
 * 실패하면 그대로 둔다 — 다음 기회에 다시 온다. 여기서 대기열을 비우면
 * 잃는 것이 생긴다.
 */
export async function drainOutbox(): Promise<void> {
	for (const { docId, content } of await held()) {
		await writeDoc(docId, content);
	}
}
