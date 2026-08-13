import { writeDoc } from "#/entities/manuscript";
import { safeGetItem, savePreference } from "#/shared/lib/storage";
import { listAccountBodies } from "../api/legacy-store";

/**
 * 계정 칸에만 있는 본문을 서버로 올린다.
 *
 * **묻지 않고 한다.** 이것은 원고를 옮기는 일이 아니라 **끊긴 올리기를 마저
 * 끝내는 일**이다 — 이미 그 사람의 계정 원고이고, 서버가 정본이 되기 전에
 * 뒤에서 밀어 넣던 것이 다 가지 못했을 뿐이다.
 *
 * 서버에 이미 있는 것은 건드리지 않는다. **404일 때만 올린다** — 다른 기기에서
 * 이어 쓴 새 본문 위에 이 브라우저의 옛 사본을 덮으면 그쪽을 잃는다.
 *
 * 실패하면 그냥 둔다. 다음에 열 때 다시 온다.
 *
 * **끝까지 마친 계정은 다시 훑지 않는다.** 원고마다 서버에 한 번씩 물어보는
 * 일이라, 표시해 두지 않으면 앱을 열 때마다 원고 수만큼 요청이 나간다.
 */
const 마쳤나 = (userId: string) =>
	safeGetItem(`wongoji:v1:lifted:${userId}`) === "1";

export async function liftAccountBodies(userId: string): Promise<number> {
	if (마쳤나(userId)) return 0;

	const bodies = await listAccountBodies(userId);
	if (!bodies.length) {
		savePreference(`wongoji:v1:lifted:${userId}`, "1");
		return 0;
	}

	let lifted = 0;
	for (const { id, content } of bodies) {
		if (content == null) continue;

		try {
			const response = await fetch(
				`/api/archive/doc/${encodeURIComponent(id)}`,
			);
			// 서버에 있다. 이쪽이 옛것이므로 손대지 않는다
			if (response.ok) continue;
			if (response.status !== 404) continue;
		} catch {
			// 물어보지 못했으면 올리지도 않는다. 다음 기회에
			return lifted;
		}

		if ((await writeDoc(id, content)).ok) lifted += 1;
	}

	// 한 바퀴를 끝까지 돌았다. 중간에 돌아 나간 경우는 여기 닿지 않는다
	savePreference(`wongoji:v1:lifted:${userId}`, "1");
	return lifted;
}
