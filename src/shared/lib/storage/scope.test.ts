import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	currentScope,
	restoreStorageScope,
	scopedDbName,
	scopedKey,
	setStorageScope,
	subscribeToScope,
} from "./scope";

/** 아주 얇은 localStorage 흉내. 칸 기억만 오간다 */
function mount() {
	const map = new Map<string, string>();
	vi.stubGlobal("window", {
		localStorage: {
			getItem: (k: string) => map.get(k) ?? null,
			setItem: (k: string, v: string) => void map.set(k, v),
			removeItem: (k: string) => void map.delete(k),
			clear: () => map.clear(),
			key: (i: number) => [...map.keys()][i] ?? null,
			get length() {
				return map.size;
			},
		},
	});
	return map;
}

beforeEach(() => {
	mount();
	setStorageScope(null);
});

afterEach(() => vi.unstubAllGlobals());

describe("칸마다 다른 자리", () => {
	it("비로그인은 지금 쓰던 키를 그대로 쓴다 — 옮겨 오지 않아도 된다", () => {
		expect(scopedKey("index")).toBe("wongoji:v1:index");
		expect(scopedKey("last")).toBe("wongoji:v1:last");
		expect(scopedDbName()).toBe("wongoji");
	});

	it("계정은 제 칸을 쓴다", () => {
		setStorageScope("usr_7k2");
		expect(scopedKey("index")).toBe("wongoji:v1:u:usr_7k2:index");
		expect(scopedDbName()).toBe("wongoji:u:usr_7k2");
	});

	it("계정이 다르면 자리도 다르다", () => {
		setStorageScope("가");
		const 가 = scopedKey("index");
		setStorageScope("나");
		expect(scopedKey("index")).not.toBe(가);
	});

	/*
	 * 이것이 어긋나면 원고가 지워진다.
	 *
	 * 고아 정리는 저장소를 훑어 "색인에 없는 본문"을 지운다. 한쪽 앞머리가 다른
	 * 쪽의 앞머리이면, 로그인한 순간 계정 색인에 없다는 이유로 비로그인 본문이
	 * 전부 고아로 보인다.
	 */
	it("두 칸의 앞머리는 서로의 앞머리가 아니다", () => {
		const 비로그인 = scopedKey("doc:a1");
		setStorageScope("usr_7k2");
		const 계정 = scopedKey("doc:a1");

		expect(계정.startsWith(비로그인)).toBe(false);
		expect(비로그인.startsWith(계정)).toBe(false);
	});
});

describe("칸이 갈렸다고 알린다", () => {
	it("바뀌면 구독자에게 알린다", () => {
		let heard = 0;
		const off = subscribeToScope(() => {
			heard += 1;
		});

		setStorageScope("usr_7k2");
		expect(heard).toBe(1);

		off();
	});

	it("같은 칸으로 다시 넣으면 알리지 않는다 — 다시 그릴 이유가 없다", () => {
		setStorageScope("usr_7k2");

		let heard = 0;
		const off = subscribeToScope(() => {
			heard += 1;
		});
		setStorageScope("usr_7k2");

		expect(heard).toBe(0);
		off();
	});

	it("구독자 하나가 터져도 나머지는 받는다", () => {
		const heard: string[] = [];
		const off1 = subscribeToScope(() => {
			throw new Error("구독자 사정");
		});
		const off2 = subscribeToScope(() => heard.push("두번째"));

		setStorageScope("usr_7k2");

		expect(heard).toEqual(["두번째"]);
		off1();
		off2();
	});
});

describe("지난번 칸으로 시작한다", () => {
	/*
	 * 새로고침은 메모리만 비우고 저장소는 남긴다. 그것을 흉내 내려고 기억된 키를
	 * 직접 심는다 — `setStorageScope`로는 안 된다. 그쪽은 기억까지 함께 고친다.
	 */
	it("적어 둔 칸을 되살린다 — 세션을 기다리지 않는다", () => {
		const map = mount();
		map.set("wongoji:v1:scope", "usr_7k2");

		expect(restoreStorageScope()).toBe("usr_7k2");
		expect(currentScope()).toBe("usr_7k2");
	});

	it("적어 둔 것이 없으면 비로그인이다", () => {
		mount();
		expect(restoreStorageScope()).toBeNull();
	});

	it("로그아웃도 적어 둔다 — 다음에 열면 비로그인으로 시작한다", () => {
		const map = mount();
		setStorageScope("usr_7k2");
		setStorageScope(null);

		expect(map.get("wongoji:v1:scope")).toBe("");
		expect(restoreStorageScope()).toBeNull();
	});
});
