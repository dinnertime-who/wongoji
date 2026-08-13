import { createFileRoute } from "@tanstack/react-router";
// createFileRoute의 `server` 옵션은 react-start가 declare module로 얹는다
import type {} from "@tanstack/react-start";
import { listVersions, restoreVersion } from "#/server/archive";
import { db } from "#/server/db";
import { currentUserId, unauthorized } from "#/server/session";

/**
 * 원고 하나의 이력.
 *
 * - `GET` — 남아 있는 버전들. **본문은 빼고 준다** — 목록 한 번에 원고 전체가
 *   딸려 오지 않게, 첫머리 발췌만 함께 보낸다
 * - `POST` — 그 버전으로 되돌린다. 되돌리기 전에 지금 원고도 이력에 남는다
 *
 * 색인 연산(`/api/archive/ops`)이 아니라 본문 라우트 아래 둔다. 버전이 담는
 * 것이 본문이고, 되돌리기도 본문을 갈아 끼우는 일이다.
 */
export const Route = createFileRoute("/api/archive/doc/$docId/versions")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const userId = await currentUserId(request);
				if (!userId) return unauthorized();

				return Response.json({
					versions: await listVersions(db, userId, params.docId),
				});
			},

			POST: async ({ request, params }) => {
				const userId = await currentUserId(request);
				if (!userId) return unauthorized();

				let versionId: unknown;
				try {
					versionId = (await request.json<{ versionId: unknown }>()).versionId;
				} catch {
					versionId = undefined;
				}
				if (typeof versionId !== "string") {
					return Response.json(
						{ error: "되돌릴 버전을 알 수 없습니다" },
						{ status: 400 },
					);
				}

				const index = await restoreVersion(db, userId, params.docId, versionId);
				/*
				 * 없는 버전이거나 남의 원고의 것이다. 둘을 가리지 않는다 — 가려서
				 * 답하면 남의 id가 있는지 없는지를 알려 주는 셈이다.
				 */
				if (!index) {
					return Response.json(
						{ error: "되돌릴 수 없습니다" },
						{ status: 404 },
					);
				}

				return Response.json({ index });
			},
		},
	},
});
