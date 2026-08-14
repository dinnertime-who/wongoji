import { describe, expect, it } from "vitest";
import { applyArchiveOp, readArchive } from "#/server/archive";
import { db, 계정, 글, 요청, 핸들러 } from "#/server/testing/harness";
import { Route } from "./api.archive.doc.$docId";

/**
 * 원고 하나의 본문.
 *
 * **저장 실패 한 번이 문단 하나가 사라지는 일이다.** 그래서 여기서 보는 것은
 * 성공 경로보다 갈림길이다 — 없는 것과 못 읽은 것, 고친 것과 열기만 한 것.
 *
 * 완성본 강등도 이 라우트에 산다. 색인 연산은 본문을 모르므로 "본문이
 * 바뀌었다"를 아는 곳이 여기뿐이다.
 */

const { GET, PUT } = 핸들러(Route);

const 읽는다 = (docId: string, cookie?: string) =>
	GET({
		request: 요청(`/api/archive/doc/${docId}`, { cookie }),
		params: { docId },
	});

const 쓴다 = (docId: string, body: unknown, cookie?: string) =>
	PUT({
		request: 요청(`/api/archive/doc/${docId}`, {
			method: "PUT",
			cookie,
			body,
		}),
		params: { docId },
	});

/** 원고 하나를 만들어 id를 준다 */
async function 원고(userId: string): Promise<string> {
	const { createdDocId } = await applyArchiveOp(db, userId, {
		kind: "createDoc",
		path: "/",
	});
	if (!createdDocId) throw new Error("원고를 만들지 못했다");
	return createdDocId;
}

describe("로그인", () => {
	it("로그인하지 않으면 읽지도 쓰지도 못한다", async () => {
		expect((await 읽는다("아무거나")).status).toBe(401);
		expect((await 쓴다("아무거나", { content: 글("글") })).status).toBe(401);
	});
});

describe("읽기", () => {
	it("넣은 본문을 그대로 준다", async () => {
		const { userId, cookie } = await 계정("본문-읽기");
		const docId = await 원고(userId);
		await 쓴다(docId, { content: 글("감나무 있는 마당") }, cookie);

		const 답 = await 읽는다(docId, cookie);
		expect(답.status).toBe(200);
		expect(await 답.json()).toEqual({ content: 글("감나무 있는 마당") });
	});

	it("본문이 없으면 404다", async () => {
		/*
		 * **404와 그 밖을 가리는 것이 중요하다.** 브라우저는 404만 "없음"으로 읽고
		 * 나머지는 "닿지 못함"으로 읽는데(`readDoc`), 뭉뚱그리면 연결이 끊겼을 뿐인
		 * 원고에 대고 "빈 원고로 시작"을 누르게 된다.
		 */
		const { userId, cookie } = await 계정("본문-없음");
		const docId = await 원고(userId);
		expect((await 읽는다(docId, cookie)).status).toBe(404);
	});

	it("남의 본문은 없는 것이다", async () => {
		const 주인 = await 계정("본문-주인");
		const 남 = await 계정("본문-남");
		const docId = await 원고(주인.userId);
		await 쓴다(docId, { content: 글("내 글") }, 주인.cookie);

		expect((await 읽는다(docId, 남.cookie)).status).toBe(404);
	});
});

describe("쓰기", () => {
	it("본문이 없는 몸통은 400이다", async () => {
		const { userId, cookie } = await 계정("쓰기-빈몸통");
		const docId = await 원고(userId);

		expect((await 쓴다(docId, {}, cookie)).status).toBe(400);
		// **null은 본문이다.** 빈 원고를 저장하는 길이 막히면 안 된다
		expect((await 쓴다(docId, { content: null }, cookie)).status).toBe(200);
	});

	it("JSON이 아니어도 터지지 않는다", async () => {
		const { userId, cookie } = await 계정("쓰기-깨진몸통");
		const docId = await 원고(userId);

		const 답 = await PUT({
			request: new Request(`http://localhost:3000/api/archive/doc/${docId}`, {
				method: "PUT",
				headers: { cookie, "Content-Type": "application/json" },
				body: "{이건 JSON이 아니다",
			}),
			params: { docId },
		});
		expect(답.status).toBe(400);
	});
});

describe("완성본 강등", () => {
	const 완성 = (userId: string, id: string) =>
		applyArchiveOp(db, userId, {
			kind: "updateDoc",
			id,
			patch: { status: "done" },
		});

	it("완성본을 고치면 퇴고로 내리고 그 사실을 실어 보낸다", async () => {
		const { userId, cookie } = await 계정("강등-고침");
		const docId = await 원고(userId);
		await 쓴다(docId, { content: 글("처음 글") }, cookie);
		await 완성(userId, docId);

		const 답 = await 쓴다(docId, { content: 글("고친 글") }, cookie);

		expect(await 답.json()).toEqual({ ok: true, demoted: "revising" });
		expect((await readArchive(db, userId)).docs[0]?.status).toBe("revising");
	});

	it("열기만 해서 같은 본문이 다시 써지는 것으로는 내리지 않는다", async () => {
		/*
		 * **여기가 라벨을 쓸모 있게 만드는 자리다.** 에디터는 원고를 앉힐 때마다 한
		 * 번 알리고 그것이 저장 큐를 탄다. 그 쓰기로 완성이 풀리면 완성본을 열어
		 * 보기만 해도 라벨이 사라진다.
		 */
		const { userId, cookie } = await 계정("강등-열기만");
		const docId = await 원고(userId);
		await 쓴다(docId, { content: 글("그대로인 글") }, cookie);
		await 완성(userId, docId);

		const 답 = await 쓴다(docId, { content: 글("그대로인 글") }, cookie);

		expect(await 답.json()).toEqual({ ok: true, demoted: null });
		expect((await readArchive(db, userId)).docs[0]?.status).toBe("done");
	});

	it("완성본이 아니면 알릴 것이 없다", async () => {
		const { userId, cookie } = await 계정("강등-초고");
		const docId = await 원고(userId);

		const 답 = await 쓴다(docId, { content: 글("초고") }, cookie);
		expect(await 답.json()).toEqual({ ok: true, demoted: null });
	});
});
