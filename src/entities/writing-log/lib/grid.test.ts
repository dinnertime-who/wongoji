import { describe, expect, it } from "vitest";
import type { WritingLog } from "../model/types";
import { buildGrid, levelOf } from "./grid";

/** 2026-08-19는 수요일이다 */
const 오늘 = "2026-08-19";

describe("격자 모양", () => {
	it("주 수만큼 세로줄이 서고 줄마다 일곱 칸이다", () => {
		const grid = buildGrid(오늘, [], 53);
		expect(grid).toHaveLength(53);
		for (const week of grid) expect(week.days).toHaveLength(7);
	});

	it("마지막 줄이 이번 주고, 오늘이 제 요일 자리에 있다", () => {
		const last = buildGrid(오늘, [], 53).at(-1);
		// 수요일 = 0부터 세어 셋째 칸
		expect(last?.days[3]?.day).toBe(오늘);
	});

	/*
	 * 아직 오지 않은 날을 0으로 채우면 "그날 안 썼다"로 읽힌다. 토요일에 보는
	 * 사람에게 앞으로 사흘을 이미 놓친 것처럼 보이면 안 된다.
	 */
	it("오늘 뒤는 빈자리로 둔다", () => {
		const last = buildGrid(오늘, [], 53).at(-1);
		expect(last?.days.slice(0, 4).every(Boolean)).toBe(true);
		expect(last?.days.slice(4)).toEqual([null, null, null]);
	});

	it("첫 줄은 일요일에서 시작한다", () => {
		const first = buildGrid(오늘, [], 53)[0];
		// 오늘(수)의 일요일 2026-08-16에서 52주를 되짚은 자리
		expect(first?.days[0]?.day).toBe("2025-08-17");
	});

	it("오늘이 일요일이면 마지막 줄에 오늘 하나만 있다", () => {
		const last = buildGrid("2026-08-16", [], 53).at(-1);
		expect(last?.days[0]?.day).toBe("2026-08-16");
		expect(last?.days.slice(1)).toEqual([null, null, null, null, null, null]);
	});

	it("오늘이 토요일이면 마지막 줄이 꽉 찬다", () => {
		const last = buildGrid("2026-08-22", [], 53).at(-1);
		expect(last?.days.every(Boolean)).toBe(true);
		expect(last?.days[6]?.day).toBe("2026-08-22");
	});
});

describe("칸 채우기", () => {
	const log: WritingLog = [
		{ day: "2026-08-17", chars: 1200 },
		{ day: "2026-08-18", chars: -340 },
		{ day: "2026-08-19", chars: 0 },
	];

	const 칸 = (day: string) =>
		buildGrid(오늘, log, 53)
			.flatMap((w) => w.days)
			.find((c) => c?.day === day);

	it("쓴 날은 글자 수가 실린다", () => {
		expect(칸("2026-08-17")).toMatchObject({ chars: 1200, level: 3 });
	});

	/* 이 잔디가 GitHub과 갈리는 자리다 */
	it("줄인 날도 한 칸 심긴다", () => {
		expect(칸("2026-08-18")).toMatchObject({ chars: -340, level: 1 });
	});

	it("순증이 정확히 0인 날도 심긴다 — 오타를 고친 날이다", () => {
		expect(칸("2026-08-19")).toMatchObject({ chars: 0, level: 1 });
	});

	it("기록이 없는 날만 0이다", () => {
		expect(칸("2026-08-16")).toMatchObject({ chars: 0, level: 0 });
	});

	it("격자 밖의 기록은 들어오지 않는다", () => {
		const 옛날 = buildGrid(오늘, [{ day: "2019-01-01", chars: 9999 }], 53);
		expect(옛날.flatMap((w) => w.days).some((c) => c && c.chars > 0)).toBe(
			false,
		);
	});
});

describe("진하기", () => {
	it("매수로 가른다", () => {
		expect(levelOf(-500)).toBe(1);
		expect(levelOf(0)).toBe(1);
		expect(levelOf(199)).toBe(1);
		expect(levelOf(200)).toBe(2);
		expect(levelOf(999)).toBe(2);
		expect(levelOf(1000)).toBe(3);
		expect(levelOf(1999)).toBe(3);
		expect(levelOf(2000)).toBe(4);
		expect(levelOf(50000)).toBe(4);
	});
});
