import { describe, expect, it } from "vitest";
import { readCookie } from "./cookie";

/**
 * 쿠키 헤더 읽기.
 *
 * **서버가 첫 HTML을 그리기 직전에 부르는 자리다.** 여기서 잘못 읽으면 화면이
 * 엉뚱한 모습으로 나갔다가 하이드레이션 뒤에 제자리를 찾아, 없애려던 덜컥임이
 * 그대로 돌아온다.
 */

describe("readCookie", () => {
	it("여러 쿠키 사이에서 제 것을 찾는다", () => {
		const header = "better-auth.session=abc; wongoji_panel=0:240; theme=light";
		expect(readCookie(header, "wongoji_panel")).toBe("0:240");
	});

	it("맨 앞이든 맨 뒤든 찾는다", () => {
		expect(readCookie("wongoji_panel=1:300; x=1", "wongoji_panel")).toBe(
			"1:300",
		);
		expect(readCookie("x=1; wongoji_panel=1:300", "wongoji_panel")).toBe(
			"1:300",
		);
	});

	it("이름이 겹쳐 보이는 쿠키에 속지 않는다", () => {
		// 경계를 짓지 않으면 이쪽이 먼저 걸려 엉뚱한 값을 읽는다
		expect(readCookie("x_wongoji_panel=1:999", "wongoji_panel")).toBeNull();
		expect(readCookie("wongoji_panel_x=1:999", "wongoji_panel")).toBeNull();
	});

	it("퍼센트 인코딩을 푼다", () => {
		expect(readCookie("wongoji_tz=Asia%2FSeoul", "wongoji_tz")).toBe(
			"Asia/Seoul",
		);
	});

	it("인코딩이 깨져 있으면 없는 것으로 본다 — 던지지 않는다", () => {
		expect(readCookie("wongoji_tz=%E0%A4%A", "wongoji_tz")).toBeNull();
	});

	it("없거나 빈 헤더는 null이다", () => {
		expect(readCookie(null, "wongoji_panel")).toBeNull();
		expect(readCookie(undefined, "wongoji_panel")).toBeNull();
		expect(readCookie("", "wongoji_panel")).toBeNull();
		expect(readCookie("x=1; y=2", "wongoji_panel")).toBeNull();
	});
});
