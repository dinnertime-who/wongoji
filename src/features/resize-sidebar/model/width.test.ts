import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clampWidth,
	parseWidth,
	readWidth,
	SIDEBAR_MAX,
	SIDEBAR_MIN,
	writeWidth,
} from "./width";

/**
 * 보관함 폭.
 *
 * 화면 설정이라 잃어도 되는 값이다. 다만 **읽을 때 가려야 한다** — 사람이 손으로
 * 고쳐 둘 수 있는 자리이고, 아무 글자나 그대로 통과하면 보관함이 화면을 통째로
 * 덮거나 실오라기만큼 남는다.
 */

function fakeStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		key: (i: number) => [...map.keys()][i] ?? null,
		getItem: (k: string) => map.get(k) ?? null,
		removeItem: (k: string) => void map.delete(k),
		setItem: (k: string, v: string) => void map.set(k, v),
	};
}

let storage: Storage;

beforeEach(() => {
	storage = fakeStorage();
	vi.stubGlobal("window", { localStorage: storage });
});

afterEach(() => vi.unstubAllGlobals());

describe("접기", () => {
	it("범위 안이면 그대로 둔다", () => {
		expect(clampWidth(320)).toBe(320);
	});

	it("양 끝을 넘으면 끝에 세운다", () => {
		expect(clampWidth(0)).toBe(SIDEBAR_MIN);
		expect(clampWidth(-9999)).toBe(SIDEBAR_MIN);
		expect(clampWidth(10_000)).toBe(SIDEBAR_MAX);
	});

	it("소수점은 버린다 — CSS로 나갈 값이다", () => {
		expect(clampWidth(320.4)).toBe(320);
		expect(clampWidth(320.6)).toBe(321);
	});
});

describe("읽기", () => {
	it("적힌 적 없으면 null이다 — 정한 적 없는 것과 정한 것은 다르다", () => {
		expect(readWidth()).toBeNull();
	});

	it("적어 둔 폭을 그대로 읽는다", () => {
		writeWidth(300);
		expect(readWidth()).toBe(300);
	});

	it("숫자가 아니면 없는 것으로 본다", () => {
		storage.setItem("wongoji:sidebarWidth", "넓게");
		expect(readWidth()).toBeNull();
		expect(parseWidth("")).toBeNull();
		expect(parseWidth(null)).toBeNull();
	});

	it("범위 밖으로 적혀 있으면 버리지 않고 접는다", () => {
		storage.setItem("wongoji:sidebarWidth", "9999");
		expect(readWidth()).toBe(SIDEBAR_MAX);
	});

	it("적을 때도 접는다 — 손잡이 바깥에서 부르는 길이 열려 있다", () => {
		writeWidth(9999);
		expect(readWidth()).toBe(SIDEBAR_MAX);
	});

	it("저장소를 쓸 수 없어도 던지지 않는다", () => {
		vi.stubGlobal("window", undefined);
		expect(readWidth()).toBeNull();
		// 못 적어도 알리지 않는다 — 다음에 열 때 기본값으로 시작한다는 뜻일 뿐이다
		expect(() => writeWidth(300)).not.toThrow();
	});
});
