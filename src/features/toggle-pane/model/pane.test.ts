import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PANE_LABEL, readPane, writePane } from "./pane";

/**
 * 좁은 화면에서 어느 쪽을 볼 것인가.
 *
 * 화면 설정이라 잃어도 되는 값이다. 다만 **읽을 때 가려야 한다** — 사람이 손으로
 * 고쳐 둘 수 있는 자리이고, 아무 글자나 그대로 통과하면 원고도 원고지도 아닌
 * 화면이 그려진다.
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

describe("읽기", () => {
	it("적힌 적 없으면 null이다 — 고른 적 없는 것과 고른 것은 다르다", () => {
		expect(readPane()).toBeNull();
	});

	it("둘 중 하나면 그대로 읽는다", () => {
		writePane("preview");
		expect(readPane()).toBe("preview");
		writePane("write");
		expect(readPane()).toBe("write");
	});

	it("둘 중 하나가 아니면 없는 것으로 본다", () => {
		storage.setItem("wongoji:mainPane", "원고지");
		expect(readPane()).toBeNull();
	});

	it("저장소를 쓸 수 없어도 던지지 않는다", () => {
		vi.stubGlobal("window", undefined);
		expect(readPane()).toBeNull();
		// 못 적어도 알리지 않는다 — 다음에 열 때 기본값으로 시작한다는 뜻일 뿐이다
		expect(() => writePane("preview")).not.toThrow();
	});
});

describe("이름", () => {
	it("둘 다 이름이 있다", () => {
		expect(PANE_LABEL.write).toBe("원고");
		expect(PANE_LABEL.preview).toBe("원고지");
	});
});
