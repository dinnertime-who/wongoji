import { createFileRoute } from "@tanstack/react-router";
// createFileRoute의 `server` 옵션은 react-start가 declare module로 얹는다
import type {} from "@tanstack/react-start";
import { db } from "#/server/db";
import { currentUserId, unauthorized } from "#/server/session";
import { grassFrom, readWritingLog } from "#/server/writing-log";
import { dayIn } from "#/shared/lib/day";
import { readTimeZone } from "#/shared/lib/timezone";

/**
 * 잔디가 읽는 것 — 지난 한 해의 하루치 기록.
 *
 * **오늘이 며칠인지도 함께 돌려준다.** 서버는 UTC에 살아서 제 힘으로는 한국의
 * 새벽 두 시를 전날이라 부른다. 시간대는 쿠키에 있고(`shared/lib/timezone.ts`),
 * 그것으로 자른 오늘을 실어 보내면 **서버가 그린 첫 격자와 브라우저가 그린
 * 격자가 같아진다** — 다르면 하이드레이션에서 격자가 한 칸씩 밀린다.
 *
 * 쓰는 길은 여기 없다. 잔디는 원고를 저장할 때 저절로 심긴다
 * (`api.archive.doc.$docId.ts`) — 따로 심는 길을 두면 원고 없이 잔디만 자란다.
 */
export const Route = createFileRoute("/api/writing-log")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const userId = await currentUserId(request);
				if (!userId) return unauthorized();

				const today = dayIn(
					Date.now(),
					readTimeZone(request.headers.get("cookie")),
				);
				const log = await readWritingLog(db, userId, grassFrom(today), today);

				return Response.json({ today, log });
			},
		},
	},
});
