import { describe, expect, it } from "vitest";
import {
	dayIn,
	daysBetween,
	isDay,
	localDay,
	shiftDay,
	utcDay,
	weekdayOf,
} from "./day";

describe("모양 가리기", () => {
	it("날짜만 통과한다", () => {
		expect(isDay("2026-08-19")).toBe(true);
		expect(isDay("2026-8-19")).toBe(false);
		expect(isDay("2026-08-19T00:00:00Z")).toBe(false);
		expect(isDay(20260819)).toBe(false);
		expect(isDay(null)).toBe(false);
	});
});

describe("시간대", () => {
	/*
	 * 이 앱이 피하려는 바로 그 어긋남이다. 한국에서 새벽 두 시에 쓴 글은 UTC로는
	 * 아직 전날인데, 그것을 잔디에 심으면 어제 칸에 들어간다.
	 */
	it("UTC와 서울이 갈리는 시각을 가른다", () => {
		const 새벽두시 = Date.UTC(2026, 7, 18, 17, 0); // 서울 8/19 02:00
		expect(utcDay(새벽두시)).toBe("2026-08-18");
		expect(dayIn(새벽두시, "Asia/Seoul")).toBe("2026-08-19");
	});

	it("날짜선 반대쪽도 같은 규칙이다", () => {
		const at = Date.UTC(2026, 7, 19, 3, 0); // 뉴욕 8/18 23:00
		expect(dayIn(at, "America/New_York")).toBe("2026-08-18");
		expect(dayIn(at, "Asia/Seoul")).toBe("2026-08-19");
	});

	it("모르는 시간대는 UTC로 떨어진다 — 던지지 않는다", () => {
		const at = Date.UTC(2026, 7, 18, 17, 0);
		expect(dayIn(at, "Mars/Olympus")).toBe("2026-08-18");
		expect(dayIn(at, null)).toBe("2026-08-18");
	});
});

describe("로컬 날짜", () => {
	it("자정 직후도 그날이다", () => {
		const d = new Date(2026, 7, 19, 0, 5);
		expect(localDay(d)).toBe("2026-08-19");
	});

	it("한 자리 달과 날에 0을 채운다", () => {
		expect(localDay(new Date(2026, 0, 3, 12))).toBe("2026-01-03");
	});
});

describe("날짜 셈", () => {
	it("앞뒤로 민다", () => {
		expect(shiftDay("2026-08-19", 1)).toBe("2026-08-20");
		expect(shiftDay("2026-08-19", -1)).toBe("2026-08-18");
	});

	it("달과 해를 넘는다", () => {
		expect(shiftDay("2026-08-31", 1)).toBe("2026-09-01");
		expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
		expect(shiftDay("2027-01-01", -1)).toBe("2026-12-31");
	});

	it("윤년의 2월을 안다", () => {
		expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
		expect(shiftDay("2026-02-28", 1)).toBe("2026-03-01");
	});

	/*
	 * 정오에서 세는 이유가 이것이다. 자정에서 세면 서머타임이 드는 날 하루가
	 * 23시간이 되어 날짜 하나를 건너뛴다.
	 */
	it("서머타임이 드는 주에도 하루씩 간다", () => {
		expect(shiftDay("2026-03-07", 1)).toBe("2026-03-08");
		expect(shiftDay("2026-03-08", 1)).toBe("2026-03-09");
		expect(shiftDay("2026-11-01", 1)).toBe("2026-11-02");
	});

	it("사이의 날 수를 센다", () => {
		expect(daysBetween("2026-08-19", "2026-08-19")).toBe(0);
		expect(daysBetween("2026-08-19", "2026-08-20")).toBe(1);
		expect(daysBetween("2026-08-20", "2026-08-19")).toBe(-1);
		expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
	});

	it("요일을 안다 — 0이 일요일", () => {
		expect(weekdayOf("2026-08-16")).toBe(0);
		expect(weekdayOf("2026-08-19")).toBe(3);
		expect(weekdayOf("2026-08-22")).toBe(6);
	});
});
