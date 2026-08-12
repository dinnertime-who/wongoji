import type { StoreIndex } from "#/entities/archive";
import type { DocContent } from "#/entities/manuscript";

/**
 * 계정 보관함으로 오가는 길.
 *
 * 서버 코드를 직접 부르지 않는다 — `#/server`는 화면 쪽에서 막혀 있고, 막혀
 * 있어야 한다. `cloudflare:workers`가 브라우저 번들에 실리면 빌드가 깨진다.
 * 그래서 타입도 여기 다시 적는다. 서버가 돌려주는 것과 갈라지면 `readArchive`가
 * 짝이므로 그쪽과 함께 고친다.
 */

/** 서버 색인. 브라우저가 모르는 것 하나 — 다른 기기에서 영영 지운 것들 */
export interface ServerArchive extends StoreIndex {
	purged: string[];
}

async function json<T>(response: Response): Promise<T> {
	if (!response.ok) {
		throw new Error(`보관함 서버가 ${response.status}로 답했습니다`);
	}
	return (await response.json()) as T;
}

/** 계정에 이미 쓰인 id. 영영 지운 것까지 센다 */
export async function fetchTakenIds(): Promise<Set<string>> {
	const { ids } = await json<{ ids: string[] }>(
		await fetch("/api/archive?ids"),
	);
	return new Set(ids);
}

export async function fetchArchive(): Promise<ServerArchive> {
	return json<ServerArchive>(await fetch("/api/archive"));
}

/** 색인을 밀어 넣는다. 있으면 고치고 없으면 만든다 — 지우지는 않는다 */
export async function pushArchive(index: StoreIndex): Promise<ServerArchive> {
	return json<ServerArchive>(
		await fetch("/api/archive", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(index),
		}),
	);
}

export async function fetchDocContent(id: string): Promise<DocContent | null> {
	const response = await fetch(`/api/archive/doc/${encodeURIComponent(id)}`);
	// 본문이 없는 것은 실패가 아니다. 아직 안 올렸을 수 있다
	if (response.status === 404) return null;
	const { content } = await json<{ content: DocContent }>(response);
	return content;
}

export async function pushDocContent(
	id: string,
	content: DocContent,
): Promise<void> {
	await json(
		await fetch(`/api/archive/doc/${encodeURIComponent(id)}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		}),
	);
}
