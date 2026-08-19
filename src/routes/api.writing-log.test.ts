import { describe, expect, it } from "vitest";
import { applyArchiveOp } from "#/server/archive";
import { db, 계정, 글, 요청, 핸들러 } from "#/server/testing/harness";
import { recordWriting } from "#/server/writing-log";
import { dayIn, utcDay } from "#/shared/lib/day";
import { TZ_COOKIE } from "#/shared/lib/timezone";
import { Route as DocRoute } from "./api.archive.doc.$docId";
import { Route } from "./api.writing-log";

/**
 * 잔디를 읽는 길, 그리고 **잔디가 심기는 자리.**
 *
 * 심는 길은 따로 없다. 원고를 저장하면 저절로 심긴다 — 그래서 여기서 가장 많이
 * 보는 것은 "심기지 않아야 하는 저장"들이다. 날짜를 안 적어 보낸 저장(옛 원고
 * 올리기), 열기만 해서 같은 본문이 다시 써진 저장, 남이 보낸 엉뚱한 날짜.
 */

const { GET } = 핸들러(Route);
const { PUT } = 핸들러(DocRoute);

const 읽는다 = (cookie?: string) =>
	GET({ request: 요청("/api/writing-log", { cookie }), params: {} });

const 쓴다 = (docId: string, body: unknown, cookie?: string) =>
	PUT({
		request: 요청(`/api/archive/doc/${docId}`, {
			method: "PUT",
			cookie,
			body,
		}),
		params: { docId },
	});

async function 원고(userId: string): Promise<string> {
	const { createdDocId } = await applyArchiveOp(db, userId, {
		kind: "createDoc",
		path: "/",
	});
	if (!createdDocId) throw new Error("원고를 만들지 못했다");
	return createdDocId;
}

type Body = { today: string; log: { day: string; chars: number }[] };
const 몸통 = async (response: Response): Promise<Body> => response.json();

/** 서버의 UTC 오늘. 관문이 이 값에서 하루 안쪽만 받는다 */
const 서버오늘 = () => utcDay(Date.now());

describe("로그인", () => {
	it("로그인하지 않으면 잔디도 없다", async () => {
		expect((await 읽는다()).status).toBe(401);
	});
});

describe("읽기", () => {
	it("남의 잔디는 보이지 않는다", async () => {
		const a = await 계정("잔디 읽기 갑");
		const b = await 계정("잔디 읽기 을");
		await recordWriting(db, a.userId, 서버오늘(), 1234);

		expect((await 몸통(await 읽는다(a.cookie))).log).toEqual([
			{ day: 서버오늘(), chars: 1234 },
		]);
		expect((await 몸통(await 읽는다(b.cookie))).log).toEqual([]);
	});

	/*
	 * 서버는 UTC에 살아서 제 힘으로는 한국의 새벽 두 시를 전날이라 부른다.
	 * 격자의 끝 칸이 어디인지를 이 값이 정하므로, 시간대를 실어 보내야 한다.
	 */
	it("오늘은 쿠키에 적힌 시간대로 자른다", async () => {
		const { cookie } = await 계정("잔디 시간대");

		const 서울 = await 몸통(await 읽는다(`${cookie}; ${TZ_COOKIE}=Asia/Seoul`));
		expect(서울.today).toBe(dayIn(Date.now(), "Asia/Seoul"));

		const 뉴욕 = await 몸통(
			await 읽는다(`${cookie}; ${TZ_COOKIE}=America/New_York`),
		);
		expect(뉴욕.today).toBe(dayIn(Date.now(), "America/New_York"));
	});

	it("시간대가 없거나 엉뚱하면 UTC로 떨어진다", async () => {
		const { cookie } = await 계정("잔디 시간대 없음");

		expect((await 몸통(await 읽는다(cookie))).today).toBe(서버오늘());
		expect(
			(await 몸통(await 읽는다(`${cookie}; ${TZ_COOKIE}=Mars/Olympus`))).today,
		).toBe(서버오늘());
	});
});

describe("심기", () => {
	it("날짜를 적어 보낸 저장이 그날에 심긴다", async () => {
		const { userId, cookie } = await 계정("잔디 심기");
		const id = await 원고(userId);

		await 쓴다(id, { content: 글("일곱 글자요"), day: 서버오늘() }, cookie);

		expect((await 몸통(await 읽는다(cookie))).log).toEqual([
			{ day: 서버오늘(), chars: 6 },
		]);
	});

	it("같은 날 여러 번 쓰면 쌓인다", async () => {
		const { userId, cookie } = await 계정("잔디 쌓기");
		const id = await 원고(userId);

		await 쓴다(id, { content: 글("가나다"), day: 서버오늘() }, cookie);
		await 쓴다(id, { content: 글("가나다라마사"), day: 서버오늘() }, cookie);

		expect((await 몸통(await 읽는다(cookie))).log).toEqual([
			{ day: 서버오늘(), chars: 6 },
		]);
	});

	it("퇴고해서 줄어든 날도 줄은 남는다", async () => {
		const { userId, cookie } = await 계정("잔디 퇴고");
		const id = await 원고(userId);

		await 쓴다(id, { content: 글("가나다라마"), day: 서버오늘() }, cookie);
		await 쓴다(id, { content: 글("가나"), day: 서버오늘() }, cookie);

		expect((await 몸통(await 읽는다(cookie))).log).toEqual([
			{ day: 서버오늘(), chars: 2 },
		]);
	});

	/*
	 * 옛 원고를 계정으로 올리는 길(`liftAccountBodies`)이 이 저장을 쓴다. 날짜를
	 * 적지 않으므로 이사 온 날 하루가 새까매지지 않는다.
	 */
	it("날짜를 안 적은 저장은 심지 않는다", async () => {
		const { userId, cookie } = await 계정("잔디 안 심기");
		const id = await 원고(userId);

		await 쓴다(id, { content: 글("옛날에 써 둔 원고") }, cookie);

		expect((await 몸통(await 읽는다(cookie))).log).toEqual([]);
	});

	/* 원고를 열기만 해도 같은 본문이 한 번 써진다 */
	it("같은 본문을 다시 쓰면 심지 않는다", async () => {
		const { userId, cookie } = await 계정("잔디 열기만");
		const id = await 원고(userId);

		await 쓴다(id, { content: 글("가나다"), day: 서버오늘() }, cookie);
		await 쓴다(id, { content: 글("가나다"), day: 서버오늘() }, cookie);

		expect((await 몸통(await 읽는다(cookie))).log).toEqual([
			{ day: 서버오늘(), chars: 3 },
		]);
	});

	/*
	 * 요청 몸통은 사람이 고칠 수 있는 자리다. 모양만 보고 믿으면 아무나 제 잔디를
	 * 한 해치 심는다.
	 */
	it("하루 넘게 벌어진 날짜는 버리되 저장은 끝낸다", async () => {
		const { userId, cookie } = await 계정("잔디 먼 날짜");
		const id = await 원고(userId);

		const response = await 쓴다(
			id,
			{ content: 글("가나다"), day: "2020-01-01" },
			cookie,
		);

		expect(response.status).toBe(200);
		expect((await 몸통(await 읽는다(cookie))).log).toEqual([]);
	});

	it("날짜가 아닌 것도 저장을 막지 않는다", async () => {
		const { userId, cookie } = await 계정("잔디 이상한 날짜");
		const id = await 원고(userId);

		const response = await 쓴다(
			id,
			{ content: 글("가나다"), day: { 어제: true } },
			cookie,
		);

		expect(response.status).toBe(200);
		expect((await 몸통(await 읽는다(cookie))).log).toEqual([]);
	});
});
