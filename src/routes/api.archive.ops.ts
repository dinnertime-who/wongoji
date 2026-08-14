import { createFileRoute } from "@tanstack/react-router";
// createFileRoute의 `server` 옵션은 react-start가 declare module로 얹는다
import type {} from "@tanstack/react-start";
import { parseOp } from "#/entities/archive";
import { applyArchiveOp } from "#/server/archive";
import { db } from "#/server/db";
import { currentUserId, unauthorized } from "#/server/session";

/**
 * 보관함에 무엇을 했는지 알린다.
 *
 * 색인 전체를 밀어 넣는 길(`POST /api/archive`)과 나눠 둔 이유는, 그쪽으로는
 * **지운 것을 알릴 수가 없기 때문이다.** 빠진 것이 "지웠다"인지 "이 기기에는
 * 없다"인지 서버가 구별할 방법이 없어서, 완전히 지운 원고가 다음 새로고침에
 * 되살아났다.
 *
 * 돌려주는 것은 바뀐 뒤의 색인 전체다. 한 사람의 색인이 작아서(원고 200편에
 * 57KB) 델타를 설계할 값이 아니다.
 *
 * **모양을 보는 일은 여기 없다.** 그것은 D1을 모르는 순수 함수(`parseOp`)의
 * 일이고, 그래서 관문을 테스트로 두드려 볼 수 있다. 이 파일에 남은 것은 요청을
 * 벗기고 답을 싸는 일뿐이다.
 */
export const Route = createFileRoute("/api/archive/ops")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const userId = await currentUserId(request);
				if (!userId) return unauthorized();

				const op = parseOp(await readBody(request));
				if (!op) {
					return Response.json(
						{ error: "연산 모양이 아닙니다" },
						{ status: 400 },
					);
				}

				return Response.json(await applyArchiveOp(db, userId, op));
			},
		},
	},
});

/** 몸통이 JSON이 아니면 연산도 아니다 */
async function readBody(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}
