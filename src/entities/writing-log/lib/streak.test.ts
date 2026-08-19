import { describe, expect, it } from "vitest";
import type { WritingLog } from "../model/types";
import { bestStreak, monthTotal, streakOn, tally } from "./streak";

/** `08-17`처럼 짧게 적고 2026년으로 편다 */
const 날 = (...days: string[]): WritingLog =>
	days.map((day) => ({ day: `2026-${day}`, chars: 100 }));

describe("지금 연속", () => {
	it("오늘까지 이어 오면 오늘을 센다", () => {
		expect(streakOn("2026-08-19", 날("08-17", "08-18", "08-19"))).toBe(3);
	});

	/*
	 * 아침에 열었다는 이유로 서른 날이 0일이 되면 안 된다. 진짜로 끊기는 것은
	 * 어제도 비었을 때다.
	 */
	it("오늘 아직 안 썼어도 어제까지의 연속을 지킨다", () => {
		expect(streakOn("2026-08-19", 날("08-17", "08-18"))).toBe(2);
	});

	it("어제도 그제도 비었으면 끊긴다", () => {
		expect(streakOn("2026-08-19", 날("08-15", "08-16"))).toBe(0);
	});

	it("아무것도 없으면 0이다", () => {
		expect(streakOn("2026-08-19", [])).toBe(0);
	});

	it("달을 넘어 이어진다", () => {
		expect(streakOn("2026-09-01", 날("08-30", "08-31", "09-01"))).toBe(3);
	});
});

describe("가장 길었던 연속", () => {
	it("끊긴 자리로 나눠 가장 긴 것을 고른다", () => {
		const log = 날("08-01", "08-02", "08-03", "08-09", "08-10");
		expect(bestStreak(log)).toBe(3);
	});

	it("하루뿐이면 1이다", () => {
		expect(bestStreak(날("08-01"))).toBe(1);
	});

	it("아무것도 없으면 0이다", () => {
		expect(bestStreak([])).toBe(0);
	});

	it("날짜가 뒤섞여 들어와도 같다", () => {
		const log = 날("08-03", "08-01", "08-02");
		expect(bestStreak(log)).toBe(3);
	});
});

describe("이번 달 합계", () => {
	it("그 달 것만 더한다", () => {
		const log: WritingLog = [
			{ day: "2026-07-31", chars: 5000 },
			{ day: "2026-08-01", chars: 1200 },
			{ day: "2026-08-19", chars: 800 },
		];
		expect(monthTotal("2026-08", log)).toBe(2000);
	});

	it("덜어낸 달은 음수다 — 감추지 않는다", () => {
		const log: WritingLog = [
			{ day: "2026-08-01", chars: 500 },
			{ day: "2026-08-02", chars: -1500 },
		];
		expect(monthTotal("2026-08", log)).toBe(-1000);
	});

	/* `2026-1`이 `2026-10`·`2026-11`을 집어삼키면 안 된다 */
	it("달 앞자리가 겹쳐 보여도 갈린다", () => {
		const log: WritingLog = [
			{ day: "2026-01-05", chars: 100 },
			{ day: "2026-10-05", chars: 900 },
			{ day: "2026-11-05", chars: 900 },
		];
		expect(monthTotal("2026-01", log)).toBe(100);
	});
});

describe("한꺼번에", () => {
	it("넷을 함께 낸다", () => {
		const log: WritingLog = [
			{ day: "2026-08-17", chars: 400 },
			{ day: "2026-08-18", chars: 600 },
			{ day: "2026-08-19", chars: -100 },
		];
		expect(tally("2026-08-19", log)).toEqual({
			streak: 3,
			best: 3,
			thisMonth: 900,
			days: 3,
		});
	});
});
