import { describe, expect, it } from "vitest";
import type { GrassCell } from "../model/types";
import { buildGrid } from "./grid";
import { describeDay, monthMarks } from "./labels";

const 칸 = (
	day: string,
	chars: number,
	level: GrassCell["level"],
): GrassCell => ({
	day,
	chars,
	level,
});

describe("칸을 말로", () => {
	it("쓴 날은 글자 수를 읽는다", () => {
		expect(describeDay(칸("2026-08-19", 1200, 3))).toBe("8월 19일 — 1,200자");
	});

	/* 색만으로는 이 둘이 갈리지 않는다 — 잔디가 지키려는 구별이 여기 있다 */
	it("덜어낸 날과 쉰 날을 갈라 읽는다", () => {
		expect(describeDay(칸("2026-08-18", -340, 1))).toBe(
			"8월 18일 — 340자 덜어냄",
		);
		expect(describeDay(칸("2026-08-16", 0, 0))).toBe("8월 16일 — 기록 없음");
	});

	it("늘지도 줄지도 않았지만 손댄 날이 있다", () => {
		expect(describeDay(칸("2026-08-17", 0, 1))).toBe("8월 17일 — 손봄");
	});

	it("한 자리 달과 날의 0을 뗀다", () => {
		expect(describeDay(칸("2026-01-03", 5, 1))).toBe("1월 3일 — 5자");
	});
});

describe("달 이름 자리", () => {
	const marks = monthMarks(buildGrid("2026-08-19", [], 53));

	it("열두 달이 한 번씩 나온다", () => {
		expect(marks).toHaveLength(12);
		expect(marks.map((m) => m.label)).toEqual([
			"9월",
			"10월",
			"11월",
			"12월",
			"1월",
			"2월",
			"3월",
			"4월",
			"5월",
			"6월",
			"7월",
			"8월",
		]);
	});

	/* 왼쪽 끝은 그 달의 도중에서 잘려 있다. 이름을 적으면 통째로 보이는 척한다 */
	it("첫 줄에는 놓지 않는다", () => {
		expect(marks.every((m) => m.at > 0)).toBe(true);
	});

	it("자리가 왼쪽에서 오른쪽으로 늘어선다", () => {
		const ats = marks.map((m) => m.at);
		expect([...ats].sort((a, b) => a - b)).toEqual(ats);
	});
});
