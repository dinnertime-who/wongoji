import { clearIndexIn, readIndexIn, remapIds } from "#/entities/archive";
import { clearDocsIn, readDocIn } from "#/entities/manuscript";
import { fetchTakenIds, pushArchive, pushDocContent } from "../api/archive-api";

/**
 * 이 기기의 비로그인 원고를 계정으로 올린다.
 *
 * 로그인했다고 저절로 하지 않는다. **묻고 나서 한다** — 아무것도 몰래 옮기지
 * 않는 편이 맞고, 계정에 이미 원고가 있는 사람에게는 원하지 않는 일일 수 있다.
 *
 * 올린 뒤에는 비로그인 칸을 비운다. 남겨 두면 사본이 둘이 되고, 로그인 중에 고친
 * 것은 계정에만 쌓여서 로그아웃하면 옛 원고가 보인다 — 없어진 것이 아니라 갈라진
 * 것인데, 사이드바 생김새가 똑같아 "쓴 것이 사라졌다"로 읽힌다.
 */

/**
 * 옮길 만한 것이 있는가. 물어볼지 정하는 데 쓴다.
 *
 * **제목도 내용도 없는 원고는 세지 않는다.** 보관함은 비어 있을 수 없어서 열
 * 때마다 빈 원고 하나가 저절로 생기는데, 그것 하나 때문에 "옮길까요?"를 물으면
 * 성가시기만 하고 옮겨 봐야 얻는 것이 없다.
 */
export function pendingUpload(): { docs: number; folders: number } {
	const local = readIndexIn(null);

	const 쓴것 = (entry: { title: string; chars?: number }) =>
		entry.title.trim().length > 0 || (entry.chars ?? 0) > 0;

	const docs = [
		...local.docs.filter(쓴것),
		// 버린 원고는 되살릴 것이라 제목만 있어도 옮길 값이 있다
		...local.trash.filter((t) => t.kind === "doc" && 쓴것(t)),
	];

	return { docs: docs.length, folders: local.folders.length };
}

export async function mergeLocalIntoAccount(): Promise<void> {
	const local = readIndexIn(null);
	if (!local.docs.length && !local.folders.length && !local.trash.length) {
		return;
	}

	/*
	 * 겹치는 id를 먼저 피한다. 로컬 id는 여덟 자 난수라 "한 브라우저 안에서만"
	 * 유일하다 — 다른 기기에서 쓴 원고와 부딪히면 그대로 덮어쓴다. 폴더 id는
	 * 경로 문자열에 박혀 있어 경로도 함께 고쳐진다.
	 */
	const taken = await fetchTakenIds();
	const { index, renamed } = remapIds(local, taken);

	/*
	 * 색인을 먼저 올린다. 본문만 올라가고 색인이 없으면 그 본문은 아무도 가리키지
	 * 않는 고아가 되어, 다음 정리에 지워진다.
	 */
	await pushArchive(index);

	/*
	 * 본문은 하나씩 올린다. 실패하면 거기서 멈춘다 — 이어서 로컬을 비우지 않으므로
	 * 다시 시도할 수 있다. 색인은 이미 올라가 있고 `pushArchive`는 덮어쓰기라
	 * 두 번 해도 같다.
	 */
	const uploads = [
		...local.docs.map((d) => d.id),
		...local.trash.filter((t) => t.kind === "doc").map((t) => t.id),
	];

	for (const oldId of uploads) {
		const content = await readDocIn(null, oldId);
		// 본문이 없는 원고는 색인만 올라간다. 여기서 빈 것을 올리면 잃은 것을 덮는다
		if (content == null) continue;
		await pushDocContent(renamed.get(oldId) ?? oldId, content);
	}

	// 여기까지 왔으면 계정에 다 있다. 이제 비운다
	clearIndexIn(null);
	await clearDocsIn(null);
}
