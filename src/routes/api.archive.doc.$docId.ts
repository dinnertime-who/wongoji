import { createFileRoute } from "@tanstack/react-router";
// createFileRoute의 `server` 옵션은 react-start가 declare module로 얹는다
import type {} from "@tanstack/react-start";
import { parseWritingDay } from "#/entities/writing-log/model/parse-day";
import {
	demoteOnEdit,
	readDocContent,
	writeDocContent,
} from "#/server/archive";
import { db } from "#/server/db";
import { currentUserId, unauthorized } from "#/server/session";
import { recordWriting } from "#/server/writing-log";
import { utcDay } from "#/shared/lib/day";

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

				let body: { content?: unknown; day?: unknown };
				try {
					body = await request.json();
				} catch {
					return Response.json({ error: "본문이 없습니다" }, { status: 400 });
				}
				const { content } = body;
				if (content === undefined) {
					return Response.json({ error: "본문이 없습니다" }, { status: 400 });
				}

				const { changed, delta } = await writeDocContent(
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
				if (!changed) return Response.json({ ok: true, demoted: null });

				/*
				 * 잔디도 여기서 심는다. **`day`가 적혀 왔을 때만 심는다** — 날짜를
				 * 아는 것은 브라우저뿐이라(시간대) 저쪽이 적어 보내는데, 그 말은
				 * **적지 않은 저장은 심지 않는다**는 뜻이기도 하다. 옛 원고를
				 * 통째로 올리는 길(`liftAccountBodies`)이 그것을 쓴다 — 이사 온
				 * 날 하루가 새까매지지 않게.
				 *
				 * 내리기와 나란히 간다. 다른 테이블이라 줄 세울 이유가 없고, 저장은
				 * 타이핑이 멎을 때마다 오는 자리라 왕복 하나가 그대로 체감된다.
				 *
				 * **`recordWriting`은 던지지 않는다.** 여기서 던지면 `Promise.all`이
				 * 통째로 깨져 저장이 500이 되고, 글자를 칠 때마다 "저장하지
				 * 못했습니다"가 뜬다 — 잔디 한 칸 때문에 치를 값이 아니라, 그
				 * 규칙을 함수 쪽에 못박아 두었다.
				 */
				const day = parseWritingDay(body.day, utcDay(Date.now()));
				const [demoted] = await Promise.all([
					demoteOnEdit(db, userId, params.docId),
					day ? recordWriting(db, userId, day, delta) : null,
				]);
				return Response.json({ ok: true, demoted });
			},
		},
	},
});
