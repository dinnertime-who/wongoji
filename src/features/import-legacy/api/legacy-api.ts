import type { StoreIndex } from "#/entities/archive";

/**
 * 옛 보관함을 계정으로 한 번에 올리는 길.
 *
 * 평소의 고치기는 여기로 오지 않는다 — 그쪽은 연산 하나씩 보내는
 * `sendOp`이다. 여기만 색인을 통째로 밀어 넣는데, 옮기는 일은 "한 번에 다"가
 * 아니면 중간에 끊겼을 때 무엇이 올라갔는지 알 수 없기 때문이다.
 */

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

/** 색인을 통째로 올린다. 있으면 고치고 없으면 만든다 — 지우지는 않는다 */
export async function pushArchive(index: StoreIndex): Promise<void> {
	await json(
		await fetch("/api/archive", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(index),
		}),
	);
}
