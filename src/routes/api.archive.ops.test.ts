import { describe, expect, it } from "vitest";
import type { StoreIndex } from "#/entities/archive";
import { readArchive } from "#/server/archive";
import { db, 계정, 요청, 핸들러 } from "#/server/testing/harness";
import { Route } from "./api.archive.ops";

/**
 * 보관함에 무엇을 했는지 알리는 길. **평소의 고치기가 전부 여기로 온다.**
 *
 * 지나는 곳이 셋인데 셋 다 따로 검사되고 있다 — 세션(`currentUserId`), 모양
 * (`parse-op.test.ts`), D1 번역(`archive.test.ts`). 여기서 보는 것은 **그 셋이
 * 이어져 있는가**다. 하나라도 빠지면 어느 단위 테스트도 울지 않는다.
 *
 * 로그인은 흉내 내지 않는다. better-auth를 실제로 지나 만든 쿠키를 쓴다
 * (`harness.ts`) — 401을 돌려주는 자리가 진짜로 막혀 있는지가 여기서 걸린다.
 */

const { POST } = 핸들러(Route);

/** 라우트를 그대로 두드린다 */
const 보낸다 = (op: unknown, cookie?: string) =>
	POST({
		request: 요청("/api/archive/ops", { method: "POST", cookie, body: op }),
		params: {},
	});

describe("로그인", () => {
	it("로그인하지 않으면 401이다", async () => {
		/*
		 * **계정 보관함은 계정이 있어야 있다.** 여기가 뚫리면 아무나 남의 원고를
		 * 고칠 수 있는데, 그것을 잡아 주는 단위 테스트가 아래에는 하나도 없다.
		 */
		const 답 = await 보낸다({ kind: "purgeAll" });
		expect(답.status).toBe(401);
	});

	it("쿠키가 엉터리여도 401이다", async () => {
		// 값은 ASCII로 둔다 — 헤더에 한글을 넣으면 브라우저에서 나지 않을 경고가 난다
		const 답 = await 보낸다(
			{ kind: "purgeAll" },
			"better-auth.session_token=not-a-real-token.not-a-real-signature",
		);
		expect(답.status).toBe(401);
	});
});

describe("모양", () => {
	it("연산이 아니면 400이다", async () => {
		const { cookie } = await 계정("ops-모양");
		expect((await 보낸다({ kind: "dropDatabase" }, cookie)).status).toBe(400);
		expect((await 보낸다({}, cookie)).status).toBe(400);
		expect((await 보낸다(null, cookie)).status).toBe(400);
	});

	it("JSON이 아니어도 400이다 — 터지지 않는다", async () => {
		const { cookie } = await 계정("ops-깨진몸통");
		const 답 = await POST({
			request: new Request("http://localhost:3000/api/archive/ops", {
				method: "POST",
				headers: { cookie, "Content-Type": "application/json" },
				body: "{이건 JSON이 아니다",
			}),
			params: {},
		});
		expect(답.status).toBe(400);
	});

	it("고칠 수 없는 칸은 걸러진 채로 들어간다", async () => {
		// `path`가 통과하면 원고가 엉뚱한 폴더로 간다. 옮기는 길은 placeEntry뿐이다
		const { userId, cookie } = await 계정("ops-패치");
		const 만듦 = await (
			await 보낸다({ kind: "createDoc", path: "/" }, cookie)
		).json<{
			createdDocId: string;
		}>();

		await 보낸다(
			{
				kind: "updateDoc",
				id: 만듦.createdDocId,
				patch: { title: "제목", path: "/남의폴더/" },
			},
			cookie,
		);

		const 뒤 = await readArchive(db, userId);
		expect(뒤.docs[0]).toMatchObject({ title: "제목", path: "/" });
	});
});

describe("연산이 실제로 걸린다", () => {
	it("만들면 서버가 id를 정해 함께 돌려준다", async () => {
		const { userId, cookie } = await 계정("ops-만들기");

		const 답 = await 보낸다({ kind: "createDoc", path: "/" }, cookie);
		const { index, createdDocId } = await 답.json<{
			index: StoreIndex;
			createdDocId?: string;
		}>();

		expect(답.status).toBe(200);
		expect(createdDocId).toBeTruthy();
		expect(index.docs).toHaveLength(1);
		// 응답에 실린 것과 저장된 것이 같아야 한다
		expect((await readArchive(db, userId)).docs[0]?.id).toBe(createdDocId);
	});

	it("버린 것이 휴지통으로 간다", async () => {
		const { cookie } = await 계정("ops-버리기");
		const { createdDocId } = await (
			await 보낸다({ kind: "createDoc", path: "/" }, cookie)
		).json<{ createdDocId: string }>();

		const { index } = await (
			await 보낸다({ kind: "trashDoc", id: createdDocId }, cookie)
		).json<{ index: StoreIndex }>();

		expect(index.docs).toEqual([]);
		expect(index.trash.map((t) => t.id)).toEqual([createdDocId]);
	});
});

describe("남의 보관함", () => {
	it("로그인해도 남의 원고는 고치지 못한다", async () => {
		/*
		 * 쿠키만 있으면 아무 id나 보낼 수 있다. 막는 것은 라우트가 아니라 **연산이
		 * 제 계정 칸에서만 도는 것**인데, 그 둘이 이어져 있는지는 여기서만 보인다.
		 */
		const 주인 = await 계정("ops-주인");
		const 남 = await 계정("ops-남");

		const { createdDocId } = await (
			await 보낸다(
				{ kind: "createDoc", path: "/", title: "내 원고" },
				주인.cookie,
			)
		).json<{ createdDocId: string }>();

		const 답 = await 보낸다({ kind: "trashDoc", id: createdDocId }, 남.cookie);
		// 거절하지 않는다 — 남의 칸에는 그런 원고가 없으니 아무 일도 일어나지 않는다
		expect(답.status).toBe(200);

		const 그쪽 = await readArchive(db, 주인.userId);
		expect(그쪽.docs).toHaveLength(1);
		expect(그쪽.trash).toEqual([]);
	});

	it("전부 비우기가 남의 것까지 비우지 않는다", async () => {
		const 주인 = await 계정("ops-전부-주인");
		const 남 = await 계정("ops-전부-남");
		await 보낸다({ kind: "createDoc", path: "/" }, 주인.cookie);
		await 보낸다({ kind: "createDoc", path: "/" }, 남.cookie);

		await 보낸다({ kind: "purgeAll" }, 남.cookie);

		expect((await readArchive(db, 주인.userId)).docs).toHaveLength(1);
	});
});
