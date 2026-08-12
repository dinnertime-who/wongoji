import { afterEach, describe, expect, it, vi } from "vitest";
import { createDoc } from "../model/operations";
import { emptyIndex } from "../model/types";
import {
	INDEX_KEY,
	indexSnapshot,
	readIndex,
	writeIndex,
} from "./index-storage";

/** localStorage 흉내 — 이 파일은 키 나열을 쓰지 않으므로 Map만으로 충분하다 */
function mount() {
	const map = new Map<string, string>();
	const storage = {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k),
		clear: () => map.clear(),
		key: (i: number) => [...map.keys()][i] ?? null,
		get length() {
			return map.size;
		},
	};
	vi.stubGlobal("window", { localStorage: storage });
	return storage;
}

afterEach(() => vi.unstubAllGlobals());

/*
 * 스냅샷의 정체성이 이 파일의 핵심이다.
 *
 * 화면이 `useSyncExternalStore`로 이것을 구독한다. React는 그릴 때마다 스냅샷을
 * 다시 물어 지난번과 `!==`이면 또 그리는데, 매번 새 객체를 주면 그 자체가 다시
 * 그릴 이유가 되어 멈추지 않는다. 무한 렌더는 화면이 아예 죽는 종류의 고장이라
 * 여기서 못박는다.
 */
describe("색인 스냅샷", () => {
	it("바뀌지 않았으면 같은 객체다", () => {
		mount();
		writeIndex(createDoc(emptyIndex(), { title: "감나무" }).index);

		expect(indexSnapshot()).toBe(indexSnapshot());
	});

	it("저장소가 비어 있어도 같은 객체다", () => {
		mount();
		expect(indexSnapshot()).toBe(indexSnapshot());
	});

	it("쓰면 새 객체가 되고, 그 뒤로는 다시 그대로다", () => {
		mount();
		const before = indexSnapshot();

		writeIndex(createDoc(emptyIndex(), { title: "감나무" }).index);
		const after = indexSnapshot();

		expect(after).not.toBe(before);
		expect(after.docs).toHaveLength(1);
		expect(indexSnapshot()).toBe(after);
	});

	it("다른 탭이 고친 것도 따라간다 — 원본 문자열을 견준다", () => {
		const storage = mount();
		const first = indexSnapshot();

		// 다른 탭이 쓴 것처럼 저장소만 바꾼다. writeIndex를 거치지 않는다
		storage.setItem(
			INDEX_KEY,
			JSON.stringify(createDoc(emptyIndex(), { title: "다른 탭" }).index),
		);

		const next = indexSnapshot();
		expect(next).not.toBe(first);
		expect(next.docs[0].title).toBe("다른 탭");
	});

	it("깨진 색인은 빈 색인으로 읽되, 그것도 같은 객체다", () => {
		const storage = mount();
		storage.setItem(INDEX_KEY, "{ 깨짐");

		expect(readIndex()).toEqual(emptyIndex());
		expect(indexSnapshot()).toBe(indexSnapshot());
	});
});
