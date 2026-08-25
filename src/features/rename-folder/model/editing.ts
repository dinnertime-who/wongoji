/**
 * 폴더 이름을 고치는 동안 손에 든 값.
 *
 * 타이핑이 멎기를 기다리는 동안 폴더가 바뀔 수 있다. 그때 밀린 것을 그대로
 * 밀어 넣으면 **앞 폴더의 글자가 지금 폴더에 쏟아진다** — 사이드바에서 폴더를
 * 빠르게 오갈 때 실제로 나던 일이다. 손에 든 값이 스스로 임자를 들고 있으면
 * 밀어 넣는 쪽이 그것을 헷갈릴 수 없다.
 *
 * 원고 제목의 같은 자리는 `save-queue.ts`다. 그쪽은 제목·본문·목표가 한 큐에
 * 섞여서 합치는 규칙이 필요하고, 여기는 이름 하나라 갈아 끼우기만 한다.
 */

/** 아직 서버로 안 보낸 이름. 어느 폴더 것인지 함께 든다 */
export interface Held {
	folderId: string;
	name: string;
}

/** 화면에 그릴 때 필요한 칸. 색인 전체를 알 필요는 없다 */
export interface Named {
	id: string;
	name: string;
}

/**
 * 한 글자를 얹는다.
 *
 * 같은 폴더면 늦게 온 값이 이긴다. 다른 폴더면 합치지 않고 갈아탄다. 앞 폴더의
 * 밀린 이름은 여기서 버려지는 것이 아니라, **부르는 쪽이 폴더를 바꾸기 전에
 * 먼저 밀어 넣는다.**
 */
export function hold(folderId: string, name: string): Held {
	return { folderId, name };
}

/**
 * 화면에 그릴 이름.
 *
 * 지금 고치고 있는 그 폴더면 손에 든 것이 이긴다. 서버가 뒤늦게 돌려준 옛
 * 이름이 치고 있는 사람을 덮으면 안 되기 때문이다. 다른 폴더면 정본을 그린다 —
 * 앞 폴더의 글자가 다음 제목에 보이면 안 된다.
 */
export function shownName(held: Held | null, folder: Named): string {
	return held && held.folderId === folder.id ? held.name : folder.name;
}

/**
 * 밀어 넣을 이름. 없으면 null.
 *
 * 정본과 같으면 보내지 않는다. 고쳤다 되돌린 글자까지 왕복시킬 이유가 없다.
 * 다른 폴더로 넘어가는 중이면 정본을 견줄 대상이 아니므로 손에 든 것을 그대로
 * 보낸다 — 임자가 함께 있으니 어디에 쓸지는 손에 든 것이 안다.
 */
export function toFlush(held: Held | null, folder: Named): Held | null {
	if (!held) return null;
	if (held.folderId === folder.id && held.name === folder.name) return null;
	return held;
}

/**
 * 이 폴더에서 아직 앞선 글자를 들고 있으면 지키고, 아니면 놓는다.
 *
 * 폴더를 갈아탔으면 놓는다. 정본이 따라잡고 **떠 있는 flush가 하나도 없으면**
 * 놓는다 — 들고 있어 봐야 버는 것이 없고, 사이드바 다이얼로그나 다른 탭이 그
 * 다음에 바꾼 이름이 제목 칸에 보이지 않는다.
 *
 * **정본이 같다만으로는 모자란다.** 디바운스가 300ms라 앞선 저장과 다음 저장이
 * 동시에 떠 있을 수 있고, 둘의 응답은 순서가 뒤바뀔 수 있다. 나중 저장의 응답이
 * 먼저 와 정본이 같아 보여도, 앞선 저장이 뒤늦게 캐시를 옛 이름으로 되돌린다.
 * 그때 이미 놓았으면 화면만 거짓말한다 — 사람이 친 것과 서버는 새 이름인데 칸은
 * 옛 이름이다.
 *
 * **그보다 앞선 글자를 들고 있으면 놓지 않는다.** 빠르게 치는 동안 `held.name`은
 * 늘 정본보다 앞선다. 늦게 온 응답이 캐시를 옛 이름으로 되돌려도 둘은 다르니
 * 손에 든 것이 남는다.
 */
export function keepHeld(
	held: Held | null,
	folder: Named,
	inFlight: number,
): Held | null {
	if (!held) return null;
	if (held.folderId !== folder.id) return null;
	if (held.name === folder.name && inFlight === 0) return null;
	return held;
}
