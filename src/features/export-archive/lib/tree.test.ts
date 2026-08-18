import { describe, expect, it } from "vitest";
import { emptyIndex, type StoreIndex } from "#/entities/archive";
import { toZipEntries } from "./tree";

/**
 * 여기서 틀리면 **받아 간 파일이 조용히 사라진다.** 같은 이름이 겹쳤을 때
 * 덮어써도 zip은 아무 말이 없고, 사람은 원고 하나가 없어진 것을 한참 뒤에나 안다.
 */

const doc = (
	id: string,
	title: string,
	path = "/",
	order = 0,
): StoreIndex["docs"][number] => ({
	id,
	title,
	path,
	order,
	goal: 0,
	chars: 0,
	sheets: 1,
	createdAt: 0,
	updatedAt: 0,
});

const folder = (
	id: string,
	name: string,
	path = "/",
	order = 0,
): StoreIndex["folders"][number] => ({ id, name, path, order });

const index = (over: Partial<StoreIndex>): StoreIndex => ({
	...emptyIndex(),
	...over,
});

const paths = (i: StoreIndex) =>
	toZipEntries(i)
		.map((e) => e.path)
		.sort();

describe("폴더 구조", () => {
	it("뿌리에 있는 원고는 뿌리에 놓인다", () => {
		expect(paths(index({ docs: [doc("d1", "첫 원고")] }))).toEqual([
			"첫 원고.txt",
		]);
	});

	it("폴더 안의 원고는 그 폴더 아래로 간다", () => {
		const i = index({
			folders: [folder("f1", "소설")],
			docs: [doc("d1", "감나무", "/f1/")],
		});
		expect(paths(i)).toEqual(["소설/감나무.txt"]);
	});

	it("폴더가 깊으면 그만큼 겹쳐 놓는다", () => {
		const i = index({
			folders: [folder("f1", "소설"), folder("f2", "단편", "/f1/")],
			docs: [doc("d1", "감나무", "/f1/f2/")],
		});
		expect(paths(i)).toEqual(["소설/단편/감나무.txt"]);
	});

	it("원고가 없는 폴더는 나오지 않는다", () => {
		const i = index({ folders: [folder("f1", "빈 폴더")], docs: [] });
		expect(paths(i)).toEqual([]);
	});
});

describe("이름이 겹칠 때", () => {
	it("같은 폴더의 같은 제목에 번호를 붙인다", () => {
		const i = index({
			docs: [doc("d1", "제목", "/", 0), doc("d2", "제목", "/", 1)],
		});
		expect(paths(i)).toEqual(["제목 (2).txt", "제목.txt"]);
	});

	it("셋이 겹치면 (2)와 (3)이다", () => {
		const i = index({
			docs: [
				doc("d1", "제목", "/", 0),
				doc("d2", "제목", "/", 1),
				doc("d3", "제목", "/", 2),
			],
		});
		expect(paths(i)).toEqual(["제목 (2).txt", "제목 (3).txt", "제목.txt"]);
	});

	it("대소문자만 다른 것도 겹친 것으로 본다 — macOS·Windows가 그렇다", () => {
		const i = index({
			docs: [doc("d1", "Note", "/", 0), doc("d2", "note", "/", 1)],
		});
		expect(paths(i)).toEqual(["Note.txt", "note (2).txt"]);
	});

	it("폴더가 다르면 같은 제목이어도 그대로 둔다", () => {
		const i = index({
			folders: [folder("f1", "가", "/", 0), folder("f2", "나", "/", 1)],
			docs: [doc("d1", "제목", "/f1/"), doc("d2", "제목", "/f2/")],
		});
		expect(paths(i)).toEqual(["가/제목.txt", "나/제목.txt"]);
	});

	it("폴더 이름이 겹쳐도 가른다", () => {
		const i = index({
			folders: [folder("f1", "소설", "/", 0), folder("f2", "소설", "/", 1)],
			docs: [doc("d1", "가", "/f1/"), doc("d2", "나", "/f2/")],
		});
		expect(paths(i)).toEqual(["소설 (2)/나.txt", "소설/가.txt"]);
	});
});

describe("이름에 쓸 수 없는 글자", () => {
	it("슬래시는 걷어낸다 — 안 그러면 경로가 무너진다", () => {
		const i = index({ docs: [doc("d1", "가/나")] });
		expect(paths(i)).toEqual(["가나.txt"]);
	});

	it("걷어내고 남는 것이 없으면 이름을 준다", () => {
		const i = index({ docs: [doc("d1", "///")] });
		expect(paths(i)).toEqual(["원고.txt"]);
	});

	it("이름 없는 원고가 여럿이어도 서로 덮지 않는다", () => {
		const i = index({
			docs: [doc("d1", "", "/", 0), doc("d2", "", "/", 1)],
		});
		expect(paths(i)).toEqual(["원고 (2).txt", "원고.txt"]);
	});
});

describe("색인이 어긋났을 때", () => {
	it("조상 폴더가 없는 원고는 뿌리에 둔다 — 빠뜨리지 않는다", () => {
		const i = index({
			folders: [],
			docs: [doc("d1", "떠도는 원고", "/없음/")],
		});
		expect(paths(i)).toEqual(["떠도는 원고.txt"]);
	});
});

describe("담는 것", () => {
	it("원고 id와 제목을 함께 들고 간다", () => {
		const [entry] = toZipEntries(index({ docs: [doc("d1", "감나무")] }));
		expect(entry).toEqual({
			path: "감나무.txt",
			docId: "d1",
			title: "감나무",
		});
	});

	it("휴지통은 담지 않는다", () => {
		const i = index({
			docs: [doc("d1", "살아 있는 것")],
			trash: [
				{
					kind: "doc",
					id: "d9",
					title: "버린 것",
					path: "/",
					goal: 0,
					deletedAt: 0,
				},
			],
		});
		expect(paths(i)).toEqual(["살아 있는 것.txt"]);
	});
});
