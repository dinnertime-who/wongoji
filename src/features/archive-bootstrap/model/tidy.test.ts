import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createDoc,
	emptyIndex,
	INDEX_KEY,
	readIndex,
	type StoreIndex,
	subscribeToIndex,
	writeIndex,
} from "#/entities/archive";
import {
	listDocIds,
	readDoc,
	removeDoc,
	writeDoc,
} from "#/entities/manuscript";
import { tidy } from "./tidy";

/**
 * localStorage 흉내.
 *
 * 키를 제 속성으로도 들고 있어야 한다 — 고아 정리가 `Object.keys(localStorage)`로
 * 훑기 때문이다. 진짜 localStorage가 그렇게 동작한다. 메서드는 프로토타입에 있어
 * `Object.keys`에 섞이지 않는다.
 */
class FakeStorage {
	private map = new Map<string, string>();
	/** 켜면 쓰기가 실패한다 */
	failWrites = false;

	getItem(key: string): string | null {
		return this.map.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		if (this.failWrites) {
			const error = new Error("quota");
			error.name = "QuotaExceededError";
			throw error;
		}
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

function mount(): FakeStorage {
	const storage = new FakeStorage();
	vi.stubGlobal("window", { localStorage: storage });
	return storage;
}

/** 본문이 남아 있는가. 이제 IndexedDB에 있다 */
const hasBody = async (id: string) => (await readDoc(id)) !== null;

/** 원고 하나가 든 색인과 그 본문 */
async function withOneDoc(
	storage: FakeStorage,
): Promise<{ index: StoreIndex; id: string }> {
	const { index, doc } = createDoc(emptyIndex(), { title: "감나무" });
	storage.setItem(INDEX_KEY, JSON.stringify(index));
	await writeDoc(doc.id, { type: "doc" });
	return { index, id: doc.id };
}

// IndexedDB는 테스트 사이에 살아남는다. 앞 테스트의 본문이 다음 테스트의
// 고아가 되지 않도록 비우고 시작한다
beforeEach(async () => {
	for (const id of await listDocIds()) await removeDoc(id);
});

afterEach(() => vi.unstubAllGlobals());

describe("색인이 깨졌을 때", () => {
	it("본문을 하나도 지우지 않고, 색인도 덮어쓰지 않는다", async () => {
		const storage = mount();
		const { id } = await withOneDoc(storage);

		// 한 바이트가 깨졌다
		storage.setItem(INDEX_KEY, '{"version":1,"docs":[{ 깨짐');
		const corrupt = storage.getItem(INDEX_KEY);

		const { result } = await tidy();

		expect(result.ok).toBe(false);
		expect(result.ok === false && result.kind).toBe("corrupt");
		// 본문이 그대로 있어야 한다. 이것을 잃으면 되돌릴 길이 없다
		expect(await hasBody(id)).toBe(true);
		// 색인도 건드리지 않는다 — 손으로 고칠 여지를 남긴다
		expect(storage.getItem(INDEX_KEY)).toBe(corrupt);
	});

	it("색인이 아예 없는 것은 깨진 것이 아니다 — 처음 온 사람이다", async () => {
		mount();
		expect((await tidy()).result.ok).toBe(true);
	});
});

describe("고아 본문 정리", () => {
	it("색인에 없는 본문을 지운다", async () => {
		const storage = mount();
		const { id } = await withOneDoc(storage);
		await writeDoc("고아", { type: "doc" });

		await tidy();

		expect(await hasBody(id)).toBe(true);
		expect(await hasBody("고아")).toBe(false);
	});

	it("휴지통에 있는 원고의 본문은 고아가 아니다 — 되살릴 것이다", async () => {
		const storage = mount();
		storage.setItem(
			INDEX_KEY,
			JSON.stringify({
				...emptyIndex(),
				trash: [
					{
						kind: "doc",
						id: "버린것",
						title: "감나무",
						goal: 0,
						path: "/",
						deletedAt: Date.now(),
					},
				],
			}),
		);
		await writeDoc("버린것", { type: "doc" });

		await tidy();

		expect(await hasBody("버린것")).toBe(true);
	});

	it("색인 저장이 실패하면 본문을 지우지 않는다", async () => {
		const storage = mount();
		const { id } = await withOneDoc(storage);
		await writeDoc("고아", { type: "doc" });
		storage.failWrites = true;

		expect((await tidy()).result.ok).toBe(false);
		// 색인은 옛 상태 그대로다. 그 색인이 가리키지 않는다고 지워 버리면 어긋난다
		expect(await hasBody("고아")).toBe(true);
		expect(await hasBody(id)).toBe(true);
	});
});

describe("색인 변경 알림", () => {
	it("구독자 하나가 터져도 저장은 성공이고 나머지는 받는다", () => {
		mount();
		const heard: string[] = [];
		const off1 = subscribeToIndex(() => {
			throw new Error("구독자 사정");
		});
		const off2 = subscribeToIndex(() => heard.push("두번째"));

		const result = writeIndex(emptyIndex());

		expect(result.ok).toBe(true);
		expect(heard).toEqual(["두번째"]);
		off1();
		off2();
	});
});

describe("readIndex", () => {
	it("못 읽으면 빈 색인을 준다 — 그리는 쪽은 그편이 맞다", () => {
		const storage = mount();
		storage.setItem(INDEX_KEY, "깨짐");
		expect(readIndex()).toEqual(emptyIndex());
	});
});
