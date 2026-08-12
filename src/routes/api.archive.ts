import { createFileRoute } from "@tanstack/react-router";
// createFileRoute의 `server` 옵션은 react-start가 declare module로 얹는다
import type {} from "@tanstack/react-start";
import type { StoreIndex } from "#/entities/archive";
import { pushArchive, readArchive, takenIds } from "#/server/archive";
import { db } from "#/server/db";
import { currentUserId, unauthorized } from "#/server/session";

/**
 * 계정 보관함.
 *
 * - `GET` — 색인 전체. 본문은 없다(원고 하나짜리 라우트가 따로 있다)
 * - `GET ?ids` — 이미 쓰인 id만. 로컬 원고를 올리기 전에 겹치는지 볼 때
 * - `POST` — 색인을 밀어 넣는다. 있으면 고치고 없으면 만든다. **지우지는 않는다**
 */
export const Route = createFileRoute("/api/archive")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const userId = await currentUserId(request);
				if (!userId) return unauthorized();

				// 올리기 전에 겹치는 id만 물어보는 길. 색인 전체를 받을 이유가 없다
				if (new URL(request.url).searchParams.has("ids")) {
					return Response.json({ ids: [...(await takenIds(db, userId))] });
				}

				return Response.json(await readArchive(db, userId));
			},

			POST: async ({ request }) => {
				const userId = await currentUserId(request);
				if (!userId) return unauthorized();

				const index = await readIndexBody(request);
				if (!index) {
					return Response.json(
						{ error: "색인 모양이 아닙니다" },
						{ status: 400 },
					);
				}

				await pushArchive(db, userId, index);
				return Response.json(await readArchive(db, userId));
			},
		},
	},
});

/**
 * 들어온 것이 색인인지 본다.
 *
 * 남이 보낸 것을 그대로 D1에 넣지 않는다. 깊이 뜯어보지는 않지만, 배열이어야 할
 * 자리가 배열인지는 보고 넘긴다 — 아니면 batch가 도중에 터져 절반만 들어간다.
 */
async function readIndexBody(request: Request): Promise<StoreIndex | null> {
	try {
		const body = await request.json();
		if (!body || typeof body !== "object") return null;

		const { version, folders, docs, trash } = body as Partial<StoreIndex>;
		/*
		 * 지금 판만 받는다. 옛 판을 올려 주는 일은 브라우저 쪽(`model/migrate.ts`)에
		 * 있고, 거기를 지난 것만 여기로 온다. 서버에 두 벌을 두면 어느 쪽이 정본인지
		 * 알 수 없게 된다.
		 */
		if (version !== 2) return null;
		if (
			!Array.isArray(folders) ||
			!Array.isArray(docs) ||
			!Array.isArray(trash)
		) {
			return null;
		}
		return { version, folders, docs, trash };
	} catch {
		return null;
	}
}
