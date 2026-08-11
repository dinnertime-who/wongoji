import { describe, expect, it } from "vitest";
import { safeGetItem, safeRemoveItem, safeSetItem } from "./local";

/** 원하는 대로 실패시킬 수 있는 가짜 저장소 */
function fakeStorage(fail?: () => Error): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		key: (i: number) => [...map.keys()][i] ?? null,
		getItem: (k: string) => map.get(k) ?? null,
		removeItem: (k: string) => void map.delete(k),
		setItem: (k: string, v: string) => {
			if (fail) throw fail();
			map.set(k, v);
		},
	} as Storage;
}

const quotaError = () => {
	const e = new Error("quota");
	e.name = "QuotaExceededError";
	return e;
};

/** Firefox는 이름이 다르다 */
const firefoxQuotaError = () => {
	const e = new Error("quota");
	e.name = "NS_ERROR_DOM_QUOTA_REACHED";
	return e;
};

describe("safeSetItem", () => {
	it("성공하면 ok를 돌려준다", () => {
		const store = fakeStorage();
		expect(safeSetItem("k", "v", store)).toEqual({ ok: true });
		expect(safeGetItem("k", store)).toBe("v");
	});

	it("상한을 넘기면 quota로 알린다 — 던지지 않는다", () => {
		const result = safeSetItem("k", "v", fakeStorage(quotaError));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.kind).toBe("quota");
			expect(result.message).toContain("저장 공간");
		}
	});

	it("Firefox의 상한 오류도 quota로 본다", () => {
		const result = safeSetItem("k", "v", fakeStorage(firefoxQuotaError));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("quota");
	});

	it("그 밖의 실패는 unavailable로 알린다", () => {
		const result = safeSetItem(
			"k",
			"v",
			fakeStorage(() => new Error("무슨 일인지 모름")),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("unavailable");
	});
});

describe("읽기·지우기는 실패해도 던지지 않는다", () => {
	it("없는 키는 null", () => {
		expect(safeGetItem("없음", fakeStorage())).toBeNull();
	});

	it("지우기는 조용히 끝난다", () => {
		const store = fakeStorage();
		safeSetItem("k", "v", store);
		safeRemoveItem("k", store);
		expect(safeGetItem("k", store)).toBeNull();
	});
});
