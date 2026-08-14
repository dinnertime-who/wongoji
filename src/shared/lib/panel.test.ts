import { describe, expect, it } from "vitest";
import { formatPanel, parsePanel, readPanel } from "./panel";

/**
 * 보관함을 어떻게 두었는가.
 *
 * 서버가 이 값을 보고 첫 HTML을 그린다. 사람이 손으로 고쳐 둘 수 있는 자리라
 * 반드시 가려야 하고, **반만 깨졌다고 나머지까지 버리면** 폭 하나 때문에
 * 접어 두었던 것까지 펴진다.
 */

describe("적고 읽기", () => {
	it("왕복한다", () => {
		expect(parsePanel(formatPanel({ open: true, width: 320 }))).toEqual({
			open: true,
			width: 320,
		});
		expect(parsePanel(formatPanel({ open: false, width: 200 }))).toEqual({
			open: false,
			width: 200,
		});
	});

	it("소수점은 버린다 — CSS로 나갈 값이다", () => {
		expect(formatPanel({ open: true, width: 320.6 })).toBe("1:321");
	});

	it("적힌 적 없으면 둘 다 null이다", () => {
		expect(parsePanel(null)).toEqual({ open: null, width: null });
		expect(parsePanel("")).toEqual({ open: null, width: null });
	});

	it("반만 깨져도 나머지는 산다", () => {
		expect(parsePanel("1:넓게")).toEqual({ open: true, width: null });
		expect(parsePanel("응:320")).toEqual({ open: null, width: 320 });
		expect(parsePanel("1")).toEqual({ open: true, width: null });
	});

	it("0 이하의 폭은 없는 것으로 본다", () => {
		expect(parsePanel("1:0").width).toBeNull();
		expect(parsePanel("1:-40").width).toBeNull();
	});
});

describe("쿠키 헤더에서", () => {
	it("제 쿠키를 찾아 읽는다", () => {
		expect(readPanel("a=1; wongoji_panel=0:240; b=2")).toEqual({
			open: false,
			width: 240,
		});
	});

	it("없으면 정한 적 없는 것이다", () => {
		expect(readPanel(null)).toEqual({ open: null, width: null });
		expect(readPanel("a=1")).toEqual({ open: null, width: null });
	});
});
