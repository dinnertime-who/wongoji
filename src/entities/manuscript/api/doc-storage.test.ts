import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 옛 본문을 IndexedDB로 옮기는 일.
 *
 * 쓰던 사람의 원고가 전부 localStorage에 있다. 저장소를 갈면서 그것을 두고 가면
 * 원고가 통째로 사라진 것처럼 보이므로, 여기가 이 변경에서 제일 위험한 자리다.
 *
 * 옮기기는 모듈 안에서 한 번만 돌도록 붙들려 있다. 매번 새 모듈을 받아야 다시
 * 볼 수 있어서 `resetModules` 뒤에 동적 import를 쓴다.
 */

const DOC_PREFIX = "wongoji:v1:doc:";

class FakeStorage {
	private map = new Map<string, string>();

	getItem(key: string): string | null {
		return this.map.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.map.set(key, value);
		(this as unknown as Record<string, string>)[key] = value;
	}
	removeItem(key: string): void {
		this.map.delete(key);
		delete (this as unknown as Record<string, string>)[key];
	}
	clear(): void {
		for (const key of [...this.map.keys()]) this.removeItem(key);
	}
	key(i: number): string | null {
		return [...this.map.keys()][i] ?? null;
	}
	get length(): number {
		return this.map.size;
	}
}

let storage: FakeStorage;

/** 옛 본문이 놓인 채로 새 저장소 모듈을 받는다 */
async function load(legacy: Record<string, string> = {}) {
	storage = new FakeStorage();
	for (const [id, raw] of Object.entries(legacy)) {
		storage.setItem(`${DOC_PREFIX}${id}`, raw);
	}
	vi.stubGlobal("window", { localStorage: storage });

	vi.resetModules();
	return await import("./doc-storage");
}

beforeEach(async () => {
	// IndexedDB는 테스트 사이에 살아남는다
	const { clearDocs } = await load();
	await clearDocs();
});

afterEach(() => vi.unstubAllGlobals());

describe("옛 본문 옮기기", () => {
	it("localStorage에 있던 본문을 IndexedDB에서 읽을 수 있다", async () => {
		const { readDoc } = await load({
			a1b2c3d4: JSON.stringify({ type: "doc", content: [] }),
		});

		expect(await readDoc("a1b2c3d4")).toEqual({ type: "doc", content: [] });
	});

	it("옮긴 뒤에는 localStorage에서 지운다 — 두 벌로 남기지 않는다", async () => {
		const { readDoc } = await load({ a1b2c3d4: '{"type":"doc"}' });

		await readDoc("a1b2c3d4");

		expect(storage.getItem(`${DOC_PREFIX}a1b2c3d4`)).toBeNull();
	});

	/*
	 * 아주 예전에는 평문으로 저장했다. JSON.parse가 터진다고 버리면 그 원고는
	 * 되살릴 길이 없다 — 문자열 그대로 옮겨 두면 `toEditorContent`가 읽어 낸다.
	 */
	it("JSON이 아닌 옛 평문도 잃지 않는다", async () => {
		const { readDoc } = await load({ 옛것: "가을이 깊었다." });

		expect(await readDoc("옛것")).toBe("가을이 깊었다.");
	});

	it("여러 벌을 한꺼번에 옮긴다", async () => {
		const { listDocIds } = await load({
			하나: '{"type":"doc"}',
			둘: '{"type":"doc"}',
			셋: '{"type":"doc"}',
		});

		expect((await listDocIds()).sort()).toEqual(["둘", "셋", "하나"]);
	});

	it("본문이 아닌 키는 건드리지 않는다", async () => {
		const { readDoc } = await load({ a1: '{"type":"doc"}' });
		storage.setItem("wongoji:v1:index", '{"version":1,"docs":[]}');
		storage.setItem("wongoji:v1:last", "a1");

		await readDoc("a1");

		expect(storage.getItem("wongoji:v1:index")).not.toBeNull();
		expect(storage.getItem("wongoji:v1:last")).toBe("a1");
	});

	it("옮길 것이 없으면 아무 일도 하지 않는다", async () => {
		const { listDocIds } = await load();
		expect(await listDocIds()).toEqual([]);
	});
});

describe("읽고 쓰기", () => {
	it("쓴 것을 그대로 읽는다", async () => {
		const { readDoc, writeDoc } = await load();

		expect((await writeDoc("a1", { type: "doc", n: 1 })).ok).toBe(true);
		expect(await readDoc("a1")).toEqual({ type: "doc", n: 1 });
	});

	it("없는 본문은 null이다", async () => {
		const { readDoc } = await load();
		expect(await readDoc("없음")).toBeNull();
	});

	it("지우면 사라진다", async () => {
		const { readDoc, removeDoc, writeDoc } = await load();

		await writeDoc("a1", { type: "doc" });
		await removeDoc("a1");

		expect(await readDoc("a1")).toBeNull();
	});
});
