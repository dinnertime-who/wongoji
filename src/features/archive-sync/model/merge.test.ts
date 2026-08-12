import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreIndex } from "#/entities/archive";
import { createDoc, createFolder, emptyIndex, ROOT } from "#/entities/archive";
import { pendingUpload } from "./merge";

/**
 * 로그인했을 때 "옮길까요?"를 물을지 정하는 규칙.
 *
 * 보관함은 비어 있을 수 없어서 열 때마다 빈 원고 하나가 저절로 생긴다. 그것까지
 * 세면 원고를 한 자도 쓴 적 없는 사람에게도 매번 묻게 된다.
 */

function mount(index: StoreIndex = emptyIndex()) {
	const map = new Map<string, string>([
		["wongoji:v1:index", JSON.stringify(index)],
	]);
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
}

beforeEach(() => mount());
afterEach(() => vi.unstubAllGlobals());

describe("옮길 것이 있는가", () => {
	it("보관함이 비어 있으면 묻지 않는다", () => {
		expect(pendingUpload()).toEqual({ docs: 0, folders: 0 });
	});

	it("갓 만들어진 빈 원고 하나는 묻지 않는다 — 저절로 생긴 것이다", () => {
		mount(createDoc(emptyIndex(), {}).index);
		expect(pendingUpload().docs).toBe(0);
	});

	it("제목만 붙여도 옮길 값이 있다", () => {
		mount(createDoc(emptyIndex(), { title: "감나무" }).index);
		expect(pendingUpload().docs).toBe(1);
	});

	it("제목이 없어도 쓴 글이 있으면 센다", () => {
		const { index, doc } = createDoc(emptyIndex(), {});
		mount({
			...index,
			docs: index.docs.map((d) => (d.id === doc.id ? { ...d, chars: 120 } : d)),
		});
		expect(pendingUpload().docs).toBe(1);
	});

	it("공백만 있는 제목은 제목이 아니다", () => {
		mount(createDoc(emptyIndex(), { title: "   " }).index);
		expect(pendingUpload().docs).toBe(0);
	});

	it("폴더를 만들었으면 원고가 비어도 묻는다 — 사람이 만든 것이다", () => {
		mount(createFolder(emptyIndex(), "단편", ROOT).index);
		expect(pendingUpload().folders).toBe(1);
	});

	it("휴지통에 든 원고도 센다 — 되살릴 것이다", () => {
		const { index } = createDoc(emptyIndex(), { title: "감나무" });
		mount({
			...emptyIndex(),
			trash: [
				{
					kind: "doc",
					id: index.docs[0].id,
					title: "감나무",
					goal: 0,
					path: ROOT,
					deletedAt: 1754000000000,
				},
			],
		});
		expect(pendingUpload().docs).toBe(1);
	});
});
