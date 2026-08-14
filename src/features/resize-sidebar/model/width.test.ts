import { describe, expect, it } from "vitest";
import { clampWidth, SIDEBAR_MAX, SIDEBAR_MIN } from "./width";

/**
 * 보관함 폭에 대한 규칙.
 *
 * 사람이 손으로 고칠 수 있는 값이 두 곳에서 들어온다 — 손잡이를 끄는 손과,
 * 쿠키에 적힌 글자. 어느 쪽이든 **여기를 지나야** 화면으로 나간다. 안 그러면
 * 보관함이 화면을 통째로 덮거나 실오라기만큼 남는다.
 */

describe("접기", () => {
	it("범위 안이면 그대로 둔다", () => {
		expect(clampWidth(320)).toBe(320);
	});

	it("양 끝을 넘으면 끝에 세운다", () => {
		expect(clampWidth(0)).toBe(SIDEBAR_MIN);
		expect(clampWidth(-9999)).toBe(SIDEBAR_MIN);
		expect(clampWidth(10_000)).toBe(SIDEBAR_MAX);
	});

	it("양 끝은 그대로 통과한다", () => {
		expect(clampWidth(SIDEBAR_MIN)).toBe(SIDEBAR_MIN);
		expect(clampWidth(SIDEBAR_MAX)).toBe(SIDEBAR_MAX);
	});

	it("소수점은 버린다 — CSS로 나갈 값이다", () => {
		expect(clampWidth(320.4)).toBe(320);
		expect(clampWidth(320.6)).toBe(321);
	});
});
