import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { WritingLogPayload } from "#/entities/writing-log";
import { readArchive, sweepExpired } from "#/server/archive";
import { auth } from "#/server/auth";
import { db } from "#/server/db";
import { grassFrom, readWritingLog } from "#/server/writing-log";
import { dayIn } from "#/shared/lib/day";
import { readPanel } from "#/shared/lib/panel";
import { readTimeZone } from "#/shared/lib/timezone";

/**
 * 첫 그림에 필요한 것을 서버에서 미리 뜬다.
 *
 * **이름이 `-`로 시작해서 라우트가 되지 않는다.** 라우트 폴더에 두는 이유는 하나,
 * `#/server`를 부를 수 있는 곳이 여기뿐이라서다(`biome.json`). 서버 함수의 몸은
 * vite 플러그인이 브라우저 번들에서 떼어 내므로 `cloudflare:workers`가 실릴 일은
 * 없고, 실리면 빌드가 곧바로 깨진다.
 *
 * ---
 *
 * 전에는 이 모두를 브라우저가 하이드레이션한 **뒤에** 하나씩 물었다. 서버는 빈
 * 껍데기를 보내고, 브라우저는 JS를 다 받은 다음에야 "누구세요"를 묻고, 그 답이
 * 와야 어느 라우트인지 알고, 그제야 색인을 묻고, 또 그제야 본문을 물었다 —
 * **왕복 넷이 한 줄로 늘어서서** 그동안 화면이 비어 있었다.
 *
 * 여기 있는 것들은 요청 안에서 D1을 곧바로 읽는다. HTTP를 한 번 더 타지 않는다.
 */

/** 화면이 아는 사람. 세션 전체를 내려보내지 않는다 — 필요한 것은 이만큼이다 */
export interface BootUser {
	id: string;
	name: string;
	email: string;
	image: string | null;
}

/** 첫 그림에 필요한 전부. 한 번에 실어 보낸다 */
export interface Boot {
	user: BootUser | null;
	/** 보관함을 접어 두었는가 · 폭은 얼마인가. 쿠키에 적혀 있다 */
	panel: { open: boolean | null; width: number | null };
}

async function userOf(request: Request): Promise<BootUser | null> {
	const session = await auth.api.getSession({ headers: request.headers });
	const user = session?.user;
	if (!user) return null;
	return {
		id: user.id,
		name: user.name ?? "",
		email: user.email ?? "",
		image: user.image ?? null,
	};
}

/**
 * 누가 보고 있고 화면을 어떻게 두었는가.
 *
 * `__root`가 한 번 부르고, 그 값이 첫 HTML에 함께 실려 온다. 브라우저가 세션을
 * 다시 묻기 전에도 화면은 이미 답을 알고 있다.
 */
export const loadBoot = createServerFn({ method: "GET" }).handler(
	async (): Promise<Boot> => {
		const request = getRequest();
		return {
			user: await userOf(request),
			panel: readPanel(request.headers.get("cookie")),
		};
	},
);

/**
 * 계정 보관함의 색인.
 *
 * `GET /api/archive`와 같은 것을 돌려주되 그 라우트를 타지 않는다. 서버가 제
 * 안에서 부르는 길이라 왕복이 없다.
 */
export const loadArchive = createServerFn({ method: "GET" }).handler(
	async () => {
		const userId = (await userOf(getRequest()))?.id;
		if (!userId) return null;

		// 기한이 지난 휴지통을 먼저 비운다. 라우트 쪽과 같은 순서다
		await sweepExpired(db, userId);
		return await readArchive(db, userId);
	},
);

/**
 * 서재가 그릴 잔디.
 *
 * **오늘을 서버가 정해서 함께 보낸다.** 잔디는 오늘이 어느 칸인지부터 정해야
 * 그려지는데, 서버는 UTC에 살아서 제 힘으로는 한국의 새벽 두 시를 전날이라
 * 부른다. 그 시간대가 쿠키에 있다(`shared/lib/timezone.ts`) — 보관함 폭을
 * 쿠키에 둔 것과 같은 이유고, 같은 덜컥거림을 막는다.
 */
export const loadWritingLog = createServerFn({ method: "GET" }).handler(
	async (): Promise<WritingLogPayload | null> => {
		const request = getRequest();
		const userId = (await userOf(request))?.id;
		if (!userId) return null;

		const today = dayIn(
			Date.now(),
			readTimeZone(request.headers.get("cookie")),
		);
		return {
			today,
			log: await readWritingLog(db, userId, grassFrom(today), today),
		};
	},
);

/**
 * `/`에 들어온 사람이 갈 곳.
 *
 * - `trial` — 로그인하지 않았다. 체험 원고 한 편을 그대로 그린다
 * - `library` — 서재로 보낸다. **서버가 곧바로 redirect한다**
 * - `empty` — 로그인했는데 보관함이 비었다. 화면이 원고 하나를 만들고 연다
 */
export type Entry = { kind: "trial" } | { kind: "library" } | { kind: "empty" };

/**
 * 어디로 보낼 것인가. **판단은 서버가 한다.**
 *
 * 전에는 이 결정이 브라우저에 있었다 — 세션도 마지막 원고도 localStorage에
 * 있어서 서버가 알 수 없었고, 그래서 `/`는 빈 화면을 보낸 다음 JS가 다 뜨고
 * 세션이 오고 색인이 와야 비로소 어디로 갈지 정했다. **왕복 넷을 지나서야 첫
 * 글자가 보였다.** 그 판단이 여기로 올라오면서 `throw redirect`가 SSR에서 진짜
 * 302가 되었고, 브라우저는 이 쪽의 JS를 받지도 않는다.
 *
 * **가는 곳이 마지막 원고에서 서재로 바뀌었다.** 302 한 번으로 끝나는 짜임은
 * 그대로다 — 바뀐 것은 목적지뿐이다.
 *
 * 보관함이 빈 사람만 예외로 둔다. 갓 만든 계정을 텅 빈 서재에 세우면 잔디도
 * 목록도 없는 화면을 보게 되므로, 그 사람에게는 원고 하나를 만들어 연다 —
 * **아무것도 없는 화면으로 시작하지 않는다**는 규칙이 그것이다.
 */
export const pickEntry = createServerFn({ method: "GET" }).handler(
	async (): Promise<Entry> => {
		const userId = (await userOf(getRequest()))?.id;
		if (!userId) return { kind: "trial" };

		const { docs } = await readArchive(db, userId);
		return docs.length === 0 ? { kind: "empty" } : { kind: "library" };
	},
);

/**
 * 원고 하나의 본문.
 *
 * 없는 원고와 남의 원고는 똑같이 null이다 — 부르는 쪽은 둘 다 "본문 없음"으로
 * 그리고, 서버가 어느 쪽인지 알려 줄 이유가 없다.
 */
/*
 * **본문은 여기서 미리 채우지 않는다.**
 *
 * 서버가 들고 있는 것이 늘 가장 새 것은 아니다. 저장에 실패한 채로 창을 닫은
 * 사람에게는 이 브라우저의 미전송 대기열(IndexedDB)에 더 새 글이 있고, 그것은
 * 브라우저만 볼 수 있다(`readDoc`이 대기열을 먼저 보는 이유다).
 *
 * 미리 채우면 그 순서가 뒤집힌다. 여는 일은 원고당 한 번만 자리를 잡으므로
 * (`opening.ts`의 `seatBody`), 서버 것이 먼저 앉으면 뒤늦게 온 대기열의 글은
 * **조용히 버려진다.** 왕복 한 번을 아끼자고 문단을 잃을 수는 없다.
 */
