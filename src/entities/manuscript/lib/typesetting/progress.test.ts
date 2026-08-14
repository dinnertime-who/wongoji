import { describe, expect, it } from "vitest";
import { goalLines, goalProgress, goalRatio, remainingLines } from "./progress";
import { ROWS } from "./types";

/**
 * 분량 목표를 재는 값들.
 *
 * **목표도 분량도 매로 잰다.** 전에는 목표를 매로 적고 분량은 글자로 재서 그
 * 사이를 200으로 나누고 곱했는데, 이 앱이 내야 하는 매수는 글자수 기준이 아니라
 * **조판 기준**이라(`docs/contest-features.md`) 그 환산이 애초에 성립하지 않는다.
 */

describe("매를 줄로", () => {
	it("한 매가 열 줄이다", () => {
		expect(goalLines(1)).toBe(ROWS);
		expect(goalLines(70)).toBe(700);
	});

	it("목표가 없으면 줄도 없다", () => {
		expect(goalLines(0)).toBe(0);
	});
});

describe("남은 줄", () => {
	it("목표까지 얼마나 남았는지 센다", () => {
		expect(remainingLines(0, 70)).toBe(700);
		expect(remainingLines(683, 70)).toBe(17);
	});

	it("넘겼으면 음수다 — 그만큼 넘긴 것이다", () => {
		expect(remainingLines(710, 70)).toBe(-10);
	});
});

describe("진행 비율", () => {
	it("반쯤 썼으면 0.5다", () => {
		expect(goalRatio(350, 70)).toBe(0.5);
	});

	it("넘겨도 1을 넘지 않는다 — 넘긴 것은 막대가 아니라 숫자로 알린다", () => {
		expect(goalRatio(1400, 70)).toBe(1);
	});

	it("목표가 없으면 0이다 — 0으로 나누지 않는다", () => {
		expect(goalRatio(350, 0)).toBe(0);
	});
});

describe("적어 보여줄 말", () => {
	it("목표가 있으면 매로 적는다", () => {
		expect(goalProgress(3, 70)).toBe("3 / 70매");
	});

	it("목표가 없으면 null이다 — 무엇을 대신 보여줄지는 자리마다 다르다", () => {
		expect(goalProgress(3, 0)).toBeNull();
	});
});
