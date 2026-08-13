import { createFileRoute } from "@tanstack/react-router";
// createFileRoute의 `server` 옵션은 react-start가 declare module로 얹는다
import type {} from "@tanstack/react-start";
import {
	demoteOnEdit,
	readDocContent,
	writeDocContent,
} from "#/server/archive";
import { db } from "#/server/db";
import { currentUserId, unauthorized } from "#/server/session";

/**
 * 원고 하나의 본문.
 *
 * 색인과 길을 나눈 이유는 로컬에서 키를 나눈 이유와 같다. 목록을 받을 때 본문이
 * 딸려 오면 원고 수만큼 무거워진다.
 */
export const Route = createFileRoute("/api/archive/doc/$docId")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const userId = await currentUserId(request);
				if (!userId) return unauthorized();

				const content = await readDocContent(db, userId, params.docId);
				// 없는 것과 못 읽은 것을 가리지 않는다. 부르는 쪽은 둘 다 "본문 없음"이다
				if (content === null) {
					return Response.json({ error: "본문이 없습니다" }, { status: 404 });
				}
				return Response.json({ content });
			},

			PUT: async ({ request, params }) => {
				const userId = await currentUserId(request);
				if (!userId) return unauthorized();

				let content: unknown;
				try {
					content = (await request.json<{ content: unknown }>()).content;
				} catch {
					return Response.json({ error: "본문이 없습니다" }, { status: 400 });
				}
				if (content === undefined) {
					return Response.json({ error: "본문이 없습니다" }, { status: 400 });
				}

				const { changed } = await writeDocContent(
					db,
					userId,
					params.docId,
					content,
				);

				/*
				 * 완성본을 **고쳤으면** 퇴고로 내린다. **본문이 실제로 써지는 이
				 * 자리에서 한다** — 색인 연산은 본문을 모르므로 "본문이 바뀌었다"를
				 * 아는 곳이 여기뿐이고, 저장하는 길이 늘어도 규칙이 한 곳에 남는다.
				 *
				 * 달라진 것이 없으면 내리지 않는다. 원고를 열기만 해도 같은 본문이
				 * 한 번 써지는데, 그것으로 완성이 풀리면 라벨이 쓸모없어진다.
				 */
				const demoted = changed
					? await demoteOnEdit(db, userId, params.docId)
					: null;
				return Response.json({ ok: true, demoted });
			},
		},
	},
});
