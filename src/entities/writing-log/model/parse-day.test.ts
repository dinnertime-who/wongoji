import { describe, expect, it } from "vitest";
import { parseWritingDay } from "./parse-day";

const 오늘 = "2026-08-19";

describe("모양", () => {
	it("날짜만 통과한다", () => {
		expect(parseWritingDay("2026-08-19", 오늘)).toBe("2026-08-19");
		expect(parseWritingDay("2026-8-19", 오늘)).toBeNull();
		expect(parseWritingDay(20260819, 오늘)).toBeNull();
		expect(parseWritingDay(undefined, 오늘)).toBeNull();
		expect(parseWritingDay({ day: "2026-08-19" }, 오늘)).toBeNull();
	});
});

describe("하루 안쪽", () => {
	/* UTC-12에서 UTC+14 사이 어디에 있어도 이 안이다 */
	it("서버의 어제·오늘·내일을 받는다", () => {
		expect(parseWritingDay("2026-08-18", 오늘)).toBe("2026-08-18");
		expect(parseWritingDay("2026-08-20", 오늘)).toBe("2026-08-20");
	});

	it("이틀 넘게 벌어지면 버린다", () => {
		expect(parseWritingDay("2026-08-17", 오늘)).toBeNull();
		expect(parseWritingDay("2026-08-21", 오늘)).toBeNull();
		expect(parseWritingDay("2020-01-01", 오늘)).toBeNull();
		expect(parseWritingDay("2099-12-31", 오늘)).toBeNull();
	});

	it("달과 해가 바뀌는 자리에서도 하루씩 센다", () => {
		expect(parseWritingDay("2026-08-31", "2026-09-01")).toBe("2026-08-31");
		expect(parseWritingDay("2025-12-31", "2026-01-01")).toBe("2025-12-31");
		expect(parseWritingDay("2025-12-30", "2026-01-01")).toBeNull();
	});
});
