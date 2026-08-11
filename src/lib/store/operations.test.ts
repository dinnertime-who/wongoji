import { describe, expect, it } from "vitest";
import {
	childrenOf,
	countDocsUnder,
	createDoc,
	createFolder,
	daysLeft,
	moveDoc,
	moveFolder,
	purgeExpired,
	repairPaths,
	restore,
	trashDoc,
	trashFolder,
	updateDoc,
} from "./operations";
import { ancestorIds, canMoveFolder, fullPath, pathNames, ROOT } from "./path";
import { emptyIndex, type StoreIndex } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

/** id를 예측 가능하게 만들어 준다 */
function seq(prefix: string) {
	let n = 0;
	return () => `${prefix}${++n}`;
}

/**
 * 신춘문예 / 2026 / 초고
 *                └ 감나무 (원고)
 * 루트에 원고 하나
 */
function sample() {
	const ids = seq("f");
	let index = emptyIndex();
	const a = createFolder(index, "신춘문예", ROOT, ids);
	index = a.index;
	const b = createFolder(index, "2026", fullPath(a.folder), ids);
	index = b.index;
	const c = createFolder(index, "초고", fullPath(b.folder), ids);
	index = c.index;

	const docIds = seq("d");
	const d1 = createDoc(
		index,
		{ title: "감나무", path: fullPath(b.folder), now: NOW },
		docIds,
	);
	index = d1.index;
	const d2 = createDoc(
		index,
		{ title: "루트 원고", path: ROOT, now: NOW },
		docIds,
	);
	index = d2.index;

	return {
		index,
		신춘문예: a.folder,
		y2026: b.folder,
		초고: c.folder,
		감나무: d1.doc,
		루트원고: d2.doc,
	};
}

describe("경로", () => {
	it("자기 id를 붙인 것이 자손을 가리는 기준이다", () => {
		expect(fullPath({ id: "f2", path: "/f1/" })).toBe("/f1/f2/");
	});

	it("조상 id를 순서대로 준다 — 브레드크럼이 이것이다", () => {
		expect(ancestorIds("/f1/f2/")).toEqual(["f1", "f2"]);
		expect(ancestorIds(ROOT)).toEqual([]);
	});

	it("이름으로 옮기되 사라진 폴더에서 멈춘다", () => {
		const { index, 감나무 } = sample();
		expect(pathNames(감나무.path, index.folders)).toEqual(["신춘문예", "2026"]);
		expect(pathNames("/없음/f2/", index.folders)).toEqual([]);
	});

	it("자기 자신이나 자손 안으로는 못 옮긴다", () => {
		const { 신춘문예, y2026 } = sample();
		expect(canMoveFolder(신춘문예, ROOT)).toBe(true);
		expect(canMoveFolder(신춘문예, fullPath(신춘문예))).toBe(false);
		expect(canMoveFolder(신춘문예, fullPath(y2026))).toBe(false); // 자손
	});
});

describe("만들기", () => {
	it("원고는 root에도 놓인다", () => {
		const { index, 루트원고 } = sample();
		expect(루트원고.path).toBe(ROOT);
		expect(childrenOf(index, ROOT).docs.map((d) => d.title)).toContain(
			"루트 원고",
		);
	});

	it("폴더가 먼저, 원고는 최근 수정순", () => {
		const { index } = sample();
		const kids = childrenOf(index, ROOT);
		expect(kids.folders.map((f) => f.name)).toEqual(["신춘문예"]);
		expect(kids.docs).toHaveLength(1);
	});
});

describe("옮기기", () => {
	it("폴더를 옮기면 그 아래 전부가 따라간다", () => {
		const { index, y2026, 감나무, 초고 } = sample();
		const next = moveFolder(index, y2026.id, ROOT);

		expect(next.folders.find((f) => f.id === y2026.id)?.path).toBe(ROOT);
		// 하위 폴더와 원고의 경로가 함께 바뀐다
		expect(next.folders.find((f) => f.id === 초고.id)?.path).toBe(
			`/${y2026.id}/`,
		);
		expect(next.docs.find((d) => d.id === 감나무.id)?.path).toBe(
			`/${y2026.id}/`,
		);
	});

	it("자손 안으로 옮기려 하면 아무 일도 없다", () => {
		const { index, 신춘문예, y2026 } = sample();
		expect(moveFolder(index, 신춘문예.id, fullPath(y2026))).toBe(index);
	});

	it("원고만 옮기는 것은 경로 하나 바꾸는 일", () => {
		const { index, 감나무 } = sample();
		expect(
			moveDoc(index, 감나무.id, ROOT).docs.find((d) => d.id === 감나무.id)
				?.path,
		).toBe(ROOT);
	});
});

describe("휴지통", () => {
	it("폴더를 버리면 그 아래 전부가 함께 간다", () => {
		const { index, 신춘문예 } = sample();
		const next = trashFolder(index, 신춘문예.id, NOW);

		expect(next.folders).toHaveLength(0);
		expect(next.docs.map((d) => d.title)).toEqual(["루트 원고"]); // root 것은 남는다
		expect(next.trash).toHaveLength(4); // 폴더 3 + 원고 1
	});

	it("되살리면 함께 온다", () => {
		const { index, 신춘문예, 감나무 } = sample();
		const trashed = trashFolder(index, 신춘문예.id, NOW);
		const back = restore(trashed, 신춘문예.id);

		expect(back.folders).toHaveLength(3);
		expect(back.docs.find((d) => d.id === 감나무.id)?.path).toBe(감나무.path);
		expect(back.trash).toHaveLength(0);
	});

	it("되살릴 자리가 사라졌으면 root로 올린다", () => {
		const { index, 감나무, 신춘문예 } = sample();
		// 원고만 먼저 버리고, 그 폴더를 통째로 지운다
		let next = trashDoc(index, 감나무.id, NOW);
		next = trashFolder(next, 신춘문예.id, NOW);
		next = purgeExpired(next, NOW + 31 * DAY).index; // 폴더가 영영 사라진다

		// 원고만 따로 되살린다 — 원래 자리는 없다
		const revived = restore(
			{
				...next,
				trash: [
					{ kind: "doc", id: 감나무.id, path: 감나무.path, deletedAt: NOW },
				],
			},
			감나무.id,
		);
		expect(revived.docs.find((d) => d.id === 감나무.id)?.path).toBe(ROOT);
	});

	it("30일이 지나면 비운다", () => {
		const { index, 감나무 } = sample();
		const trashed = trashDoc(index, 감나무.id, NOW);

		expect(purgeExpired(trashed, NOW + 29 * DAY).index.trash).toHaveLength(1);

		const gone = purgeExpired(trashed, NOW + 31 * DAY);
		expect(gone.index.trash).toHaveLength(0);
		// 본문 키를 지우라고 알려 준다
		expect(gone.removedDocIds).toEqual([감나무.id]);
	});

	it("남은 날을 센다", () => {
		const entry = {
			kind: "doc" as const,
			id: "d1",
			path: ROOT,
			deletedAt: NOW,
		};
		expect(daysLeft(entry, NOW)).toBe(30);
		expect(daysLeft(entry, NOW + 7 * DAY)).toBe(23);
		expect(daysLeft(entry, NOW + 40 * DAY)).toBe(0);
	});

	it("폴더에 든 원고 수를 센다", () => {
		const { index, 신춘문예 } = sample();
		expect(countDocsUnder(index, 신춘문예.id)).toBe(1);
	});
});

describe("다듬기", () => {
	it("사라진 폴더를 가리키면 살아 있는 조상까지 끌어올린다", () => {
		const { index, y2026 } = sample();
		// 중간 폴더만 몰래 걷어낸다 (색인이 깨진 상황)
		const broken: StoreIndex = {
			...index,
			folders: index.folders.filter((f) => f.id !== y2026.id),
		};
		const fixed = repairPaths(broken);

		// 감나무는 /f1/f2/ 에 있었다 → f2가 없으니 /f1/ 로
		expect(fixed.docs.find((d) => d.title === "감나무")?.path).toBe("/f1/");
	});

	it("조상이 전부 사라졌으면 root로", () => {
		const { index } = sample();
		const fixed = repairPaths({ ...index, folders: [] });
		for (const doc of fixed.docs) expect(doc.path).toBe(ROOT);
	});
});

describe("목록용 값", () => {
	it("저장할 때 색인에 함께 적는다", () => {
		const { index, 감나무 } = sample();
		const next = updateDoc(
			index,
			감나무.id,
			{ chars: 14007, sheets: 71 },
			NOW + 1000,
		);
		const doc = next.docs.find((d) => d.id === 감나무.id);

		expect(doc?.chars).toBe(14007);
		expect(doc?.updatedAt).toBe(NOW + 1000);
		expect(doc?.createdAt).toBe(NOW); // 만든 때는 그대로
	});
});
