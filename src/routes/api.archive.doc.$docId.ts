import { createFileRoute } from "@tanstack/react-router";
// createFileRoute의 `server` 옵션은 react-start가 declare module로 얹는다
import type {} from "@tanstack/react-start";
import { readDocContent, writeDocContent } from "#/server/archive";
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

				await writeDocContent(db, userId, params.docId, content);
				return Response.json({ ok: true });
			},
		},
	},
});
