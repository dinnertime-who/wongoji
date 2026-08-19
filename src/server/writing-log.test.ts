import { describe, expect, it } from "vitest";
import { applyArchiveOp, writeDocContent } from "./archive";
import { db, 글, 사람 } from "./testing/harness";
import { grassFrom, readWritingLog, recordWriting } from "./writing-log";

/**
 * 날마다 얼마나 썼는가 — 진짜 D1 위에서.
 *
 * 여기서 볼 것은 잔디를 그리는 규칙이 아니다. 그쪽은 순수 함수라
 * `entities/writing-log`가 이미 본다. 여기 있는 것은 **테이블이 실제로 그렇게
 * 움직이는가**다 — 더하기 upsert가 정말 더하는지, 계정 칸이 갈리는지, 그리고
 * 본문 저장이 내는 증분이 맞는지.
 */

const 오늘 = "2026-08-19";

describe("하루치 쌓기", () => {
	it("줄이 없으면 만들고, 있으면 더한다", async () => {
		const u = await 사람("잔디-더하기");

		await recordWriting(db, u, 오늘, 500);
		await recordWriting(db, u, 오늘, 300);

		expect(await readWritingLog(db, u, 오늘, 오늘)).toEqual([
			{ day: 오늘, chars: 800 },
		]);
	});

	/*
	 * 덮어쓰면 마지막 저장 한 번의 증분만 남는다. 하루에 저장은 수백 번 오고
	 * 원고도 여러 편이다.
	 */
	it("음수도 더한다 — 퇴고한 오후가 오전을 지운다", async () => {
		const u = await 사람("잔디-빼기");

		await recordWriting(db, u, 오늘, 1000);
		await recordWriting(db, u, 오늘, -1400);

		expect(await readWritingLog(db, u, 오늘, 오늘)).toEqual([
			{ day: 오늘, chars: -400 },
		]);
	});

	/* 오타 하나 고친 날과 손대지 않은 날은 다르다 */
	it("0을 더해도 줄은 생긴다", async () => {
		const u = await 사람("잔디-영");

		await recordWriting(db, u, 오늘, 0);

		expect(await readWritingLog(db, u, 오늘, 오늘)).toEqual([
			{ day: 오늘, chars: 0 },
		]);
	});

	it("날이 다르면 줄도 다르다", async () => {
		const u = await 사람("잔디-이틀");

		await recordWriting(db, u, "2026-08-18", 100);
		await recordWriting(db, u, "2026-08-19", 200);

		expect(await readWritingLog(db, u, "2026-08-01", 오늘)).toEqual([
			{ day: "2026-08-18", chars: 100 },
			{ day: "2026-08-19", chars: 200 },
		]);
	});
});

/**
 * **잔디 한 칸 때문에 원고를 잃게 할 수는 없다.**
 *
 * 이 함수는 원고 본문을 저장하는 길 한복판에서 불린다. 여기서 던지면 그 요청이
 * 500이 되고 브라우저에는 글자를 칠 때마다 "저장하지 못했습니다"가 뜬다.
 */
describe("심다 실패해도", () => {
	/** 테이블이 없는 것과 같다 — 마이그레이션보다 배포가 먼저 나간 상황 */
	const 망가진DB = {
		insert: () => {
			throw new Error("no such table: writing_day");
		},
	} as unknown as Parameters<typeof recordWriting>[0];

	it("던지지 않고 false를 준다", async () => {
		await expect(recordWriting(망가진DB, "아무개", 오늘, 500)).resolves.toBe(
			false,
		);
	});

	it("멀쩡할 때는 true다", async () => {
		const u = await 사람("잔디-심었나");
		expect(await recordWriting(db, u, 오늘, 500)).toBe(true);
	});
});

describe("구간 읽기", () => {
	it("양 끝을 포함하고 그 밖은 빼며 날짜순으로 낸다", async () => {
		const u = await 사람("잔디-구간");

		for (const [day, n] of [
			["2026-08-16", 1],
			["2026-08-17", 2],
			["2026-08-19", 3],
			["2026-08-20", 4],
		] as const) {
			await recordWriting(db, u, day, n);
		}

		expect(await readWritingLog(db, u, "2026-08-17", "2026-08-19")).toEqual([
			{ day: "2026-08-17", chars: 2 },
			{ day: "2026-08-19", chars: 3 },
		]);
	});

	/*
	 * 격자가 실제로 그리는 첫날(그 주의 일요일에서 52주 전)보다 며칠 넉넉하다.
	 * 모자라면 첫 줄 왼쪽 칸들이 까닭 없이 비고, 남는 것은 몇 줄일 뿐이다.
	 */
	it("격자보다 넉넉히 되짚는다", () => {
		expect(grassFrom("2026-08-19")).toBe("2025-08-13");
	});

	it("남의 기록은 보이지 않는다", async () => {
		const u1 = await 사람("잔디-칸-1");
		const u2 = await 사람("잔디-칸-2");

		await recordWriting(db, u1, 오늘, 999);

		expect(await readWritingLog(db, u2, 오늘, 오늘)).toEqual([]);
	});
});

describe("본문 저장이 내는 증분", () => {
	const 원고 = async (userId: string) => {
		const { createdDocId } = await applyArchiveOp(db, userId, {
			kind: "createDoc",
			path: "/",
		});
		if (!createdDocId) throw new Error("원고를 만들지 못했다");
		return createdDocId;
	};

	it("처음 쓴 본문은 통째로 증분이다", async () => {
		const u = await 사람("증분-처음");
		const id = await 원고(u);

		expect(await writeDocContent(db, u, id, 글("열 글자입니다"))).toEqual({
			changed: true,
			delta: 7,
		});
	});

	it("늘어난 만큼만 낸다", async () => {
		const u = await 사람("증분-늘기");
		const id = await 원고(u);

		await writeDocContent(db, u, id, 글("가나다"));
		expect(await writeDocContent(db, u, id, 글("가나다라마"))).toEqual({
			changed: true,
			delta: 2,
		});
	});

	/* 퇴고다. 이 값이 음수여야 잔디가 "덜어낸 날"을 알 수 있다 */
	it("줄어들면 음수다", async () => {
		const u = await 사람("증분-줄기");
		const id = await 원고(u);

		await writeDocContent(db, u, id, 글("가나다라마"));
		expect(await writeDocContent(db, u, id, 글("가나"))).toEqual({
			changed: true,
			delta: -3,
		});
	});

	/*
	 * 원고를 열기만 해도 같은 본문이 한 번 써진다. 그것으로 잔디가 심기면
	 * 읽기만 한 날에도 잔디가 자란다.
	 */
	it("같은 본문을 다시 쓰면 아무 일도 없다", async () => {
		const u = await 사람("증분-같음");
		const id = await 원고(u);

		await writeDocContent(db, u, id, 글("가나다"));
		expect(await writeDocContent(db, u, id, 글("가나다"))).toEqual({
			changed: false,
			delta: 0,
		});
	});

	/* 목록에 적히는 `chars`와 같은 값이어야 한다 — 빈 행은 글자가 아니다 */
	it("빈 행과 빈 문단은 글자로 세지 않는다", async () => {
		const u = await 사람("증분-빈줄");
		const id = await 원고(u);

		const 사이가띈원고 = {
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "가나다" }] },
				{ type: "paragraph" },
				{ type: "horizontalRule" },
				{ type: "paragraph", content: [{ type: "text", text: "라마" }] },
			],
		};

		expect(await writeDocContent(db, u, id, 사이가띈원고)).toEqual({
			changed: true,
			delta: 5,
		});
	});
});
