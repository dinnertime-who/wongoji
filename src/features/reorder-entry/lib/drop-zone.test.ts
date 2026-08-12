import { describe, expect, it } from "vitest";
import {
	createDoc,
	createFolder,
	emptyIndex,
	fullPath,
	placeEntry,
	ROOT,
	type StoreIndex,
} from "#/entities/archive";
import { placementFor, zoneOf } from "./drop-zone";

/** 높이 40, 위쪽이 100인 줄 */
const rect = { top: 100, height: 40 };
const doc = { kind: "doc" } as const;
const folder = { kind: "folder" } as const;

describe("줄의 어디에 놓는가", () => {
	it("원고 줄은 반씩 앞뒤다", () => {
		expect(zoneOf(rect, 105, doc, doc)).toBe("before");
		expect(zoneOf(rect, 135, doc, doc)).toBe("after");
	});

	it("폴더 줄은 앞뒤 25%씩, 가운데는 안으로", () => {
		expect(zoneOf(rect, 105, folder, folder)).toBe("before");
		expect(zoneOf(rect, 120, folder, folder)).toBe("into");
		expect(zoneOf(rect, 135, folder, folder)).toBe("after");
	});

	it("종류가 다르면 통째로 안으로다", () => {
		// 폴더는 늘 원고 위에 온다. 원고를 폴더 줄 사이에 끼울 자리가 없다
		expect(zoneOf(rect, 101, folder, doc)).toBe("into");
		expect(zoneOf(rect, 139, folder, doc)).toBe("into");
		expect(zoneOf(rect, 101, doc, folder)).toBe("into");
	});

	it("줄 밖으로 벗어난 좌표도 양 끝으로 본다", () => {
		expect(zoneOf(rect, -50, doc, doc)).toBe("before");
		expect(zoneOf(rect, 9999, doc, doc)).toBe("after");
	});

	it("높이가 0이어도 터지지 않는다", () => {
		// 아직 그려지지 않은 줄. 나누기가 무한대가 되면 안 된다
		expect(zoneOf({ top: 0, height: 0 }, 0, doc, doc)).toBe("after");
	});
});

/** 루트에 폴더 둘(A·B)과 원고 셋(가·나·다) */
function sample(): StoreIndex {
	let index = emptyIndex();
	const fids = () => `f${index.folders.length + 1}`;
	for (const name of ["A", "B"]) {
		index = createFolder(index, name, ROOT, fids).index;
	}
	const dids = () => `d${index.docs.length + 1}`;
	for (const title of ["가", "나", "다"]) {
		index = createDoc(index, { title }, dids).index;
	}
	return index;
}

const titles = (index: StoreIndex, path = ROOT) =>
	index.docs
		.filter((d) => d.path === path)
		.sort((a, b) => a.order - b.order)
		.map((d) => d.title);

const names = (index: StoreIndex, path = ROOT) =>
	index.folders
		.filter((f) => f.path === path)
		.sort((a, b) => a.order - b.order)
		.map((f) => f.name);

describe("자리로 옮기기", () => {
	const row = (kind: "doc" | "folder", id: string, path = ROOT) => ({
		kind,
		id,
		path,
	});

	it("앞에 놓으면 그 형제의 앞이다", () => {
		const index = sample();
		const to = placementFor(index, row("doc", "d1"), "before");
		expect(titles(placeEntry(index, { kind: "doc", id: "d3" }, to))).toEqual([
			"다",
			"가",
			"나",
		]);
	});

	it("뒤에 놓으면 다음 형제의 앞이다", () => {
		const index = sample();
		const to = placementFor(index, row("doc", "d1"), "after");
		expect(titles(placeEntry(index, { kind: "doc", id: "d3" }, to))).toEqual([
			"가",
			"다",
			"나",
		]);
	});

	it("마지막 뒤는 맨 끝이다", () => {
		const index = sample();
		const to = placementFor(index, row("doc", "d3"), "after");
		expect(to.before).toBeNull();
		expect(titles(placeEntry(index, { kind: "doc", id: "d1" }, to))).toEqual([
			"나",
			"다",
			"가",
		]);
	});

	it("이미 그 자리면 아무 일도 없다", () => {
		const index = sample();
		// 가 바로 뒤는 나다 — 나를 거기 놓는 것은 제자리다
		const to = placementFor(index, row("doc", "d1"), "after");
		expect(placeEntry(index, { kind: "doc", id: "d2" }, to)).toBe(index);
	});

	it("폴더 안으로는 그 폴더 맨 끝이다", () => {
		const index = sample();
		const to = placementFor(index, row("folder", "f1"), "into");
		expect(to.path).toBe("/f1/");
		expect(
			titles(placeEntry(index, { kind: "doc", id: "d1" }, to), "/f1/"),
		).toEqual(["가"]);
	});

	it("원고 줄에 폴더를 놓으면 그 원고가 선 자리로 간다", () => {
		let index = sample();
		const made = createFolder(index, "안쪽", "/f1/", () => "f9");
		index = made.index;

		// 폴더 f9를 루트의 원고 줄에 떨어뜨린다 — 루트의 폴더 목록 맨 끝으로
		const to = placementFor(index, row("doc", "d2"), "into");
		expect(to).toEqual({ path: ROOT, before: null });
		expect(names(placeEntry(index, { kind: "folder", id: "f9" }, to))).toEqual([
			"A",
			"B",
			"안쪽",
		]);
	});

	it("폴더끼리도 같은 규칙으로 줄을 선다", () => {
		const index = sample();
		const to = placementFor(index, row("folder", "f1"), "before");
		expect(names(placeEntry(index, { kind: "folder", id: "f2" }, to))).toEqual([
			"B",
			"A",
		]);
	});

	it("폴더 안에 든 줄의 앞뒤도 그 안에서 센다", () => {
		let index = sample();
		const inside = fullPath({ id: "f1", path: ROOT });
		index = createDoc(index, { title: "안1", path: inside }, () => "x1").index;
		index = createDoc(index, { title: "안2", path: inside }, () => "x2").index;

		const to = placementFor(index, row("doc", "x1", inside), "before");
		expect(
			titles(placeEntry(index, { kind: "doc", id: "x2" }, to), inside),
		).toEqual(["안2", "안1"]);
	});
});
