import { describe, expect, it } from "vitest";
import {
	ancestorIds,
	canMoveFolder,
	fullPath,
	pathNames,
	ROOT,
} from "../lib/path";
import {
	childrenOf,
	copyTitle,
	countDocsUnder,
	createDoc,
	createFolder,
	daysLeft,
	duplicateDoc,
	moveDoc,
	moveFolder,
	purge,
	purgeExpired,
	repairPaths,
	restore,
	trashDoc,
	trashFolder,
	updateDoc,
	usedSheets,
} from "./operations";
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
					{
						kind: "doc",
						id: 감나무.id,
						title: 감나무.title,
						goal: 감나무.goal,
						path: 감나무.path,
						deletedAt: NOW,
					},
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
			title: "",
			goal: 0,
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

describe("복제", () => {
	it("제목에 사본을 붙인다", () => {
		expect(copyTitle("감나무 있는 마당", [])).toBe("감나무 있는 마당 (사본)");
	});

	it("같은 이름이 있으면 번호를 올린다", () => {
		const taken = ["감나무", "감나무 (사본)"];
		expect(copyTitle("감나무", taken)).toBe("감나무 (사본 2)");
		expect(copyTitle("감나무", [...taken, "감나무 (사본 2)"])).toBe(
			"감나무 (사본 3)",
		);
	});

	it("사본의 사본이 늘어지지 않는다", () => {
		expect(copyTitle("감나무 (사본)", ["감나무 (사본)"])).toBe(
			"감나무 (사본 2)",
		);
		expect(copyTitle("감나무 (사본 2)", [])).toBe("감나무 (사본)");
	});

	it("제목이 없으면 사본도 없는 채로 둔다", () => {
		// 없던 제목을 지어내면 내보낸 워드 문서에 찍힌다
		expect(copyTitle("", [])).toBe("");
		expect(copyTitle("   ", [])).toBe("");
	});

	it("같은 폴더에 목표와 함께 복제된다", () => {
		let index = emptyIndex();
		const folder = createFolder(index, "2026", ROOT);
		index = folder.index;
		const made = createDoc(index, {
			title: "감나무",
			path: fullPath(folder.folder),
		});
		index = updateDoc(made.index, made.doc.id, { goal: 30 });

		const copy = duplicateDoc(index, made.doc.id);
		expect(copy).not.toBeNull();
		if (!copy) return;

		expect(copy.doc.id).not.toBe(made.doc.id);
		expect(copy.doc.title).toBe("감나무 (사본)");
		expect(copy.doc.path).toBe(fullPath(folder.folder));
		expect(copy.doc.goal).toBe(30);
		expect(copy.index.docs).toHaveLength(2);
	});

	it("없는 원고는 null", () => {
		expect(duplicateDoc(emptyIndex(), "없음")).toBeNull();
	});
});

describe("휴지통이 들고 가는 값", () => {
	it("되살리면 제목과 목표가 돌아온다", () => {
		let index = emptyIndex();
		const made = createDoc(index, { title: "감나무 있는 마당" });
		index = updateDoc(made.index, made.doc.id, { goal: 80 });

		const revived = restore(trashDoc(index, made.doc.id), made.doc.id);
		const back = revived.docs.find((d) => d.id === made.doc.id);

		expect(back?.title).toBe("감나무 있는 마당");
		expect(back?.goal).toBe(80);
	});

	it("폴더째 버려도 안의 원고가 제목을 들고 간다", () => {
		let index = emptyIndex();
		const folder = createFolder(index, "2026", ROOT);
		const made = createDoc(folder.index, {
			title: "눈 오는 날",
			path: fullPath(folder.folder),
		});
		index = made.index;

		const trashed = trashFolder(index, folder.folder.id);
		const entry = trashed.trash.find((t) => t.id === made.doc.id);
		expect(entry?.kind === "doc" && entry.title).toBe("눈 오는 날");

		const revived = restore(trashed, folder.folder.id);
		expect(revived.docs.find((d) => d.id === made.doc.id)?.title).toBe(
			"눈 오는 날",
		);
	});
});

describe("usedSheets", () => {
	it("빈 보관함은 0매다", () => {
		expect(usedSheets(emptyIndex())).toBe(0);
	});

	it("원고들의 매수를 더한다", () => {
		let index = emptyIndex();
		index = updateDoc(createDoc(index, {}, seq("d")).index, "d1", {
			sheets: 3,
		});
		index = updateDoc(createDoc(index, {}, seq("e")).index, "e1", {
			sheets: 7,
		});
		expect(usedSheets(index)).toBe(10);
	});

	it("폴더 안에 든 것도 센다 — 자리와 무관하다", () => {
		const made = createFolder(emptyIndex(), "폴더", ROOT, seq("f"));
		let index = createDoc(
			made.index,
			{ path: fullPath(made.folder) },
			seq("d"),
		).index;
		index = updateDoc(index, "d1", { sheets: 5 });
		expect(usedSheets(index)).toBe(5);
	});

	it("휴지통은 세지 않는다 — 30일 뒤 저절로 비워진다", () => {
		let index = createDoc(emptyIndex(), {}, seq("d")).index;
		index = updateDoc(index, "d1", { sheets: 9 });
		expect(usedSheets(index)).toBe(9);

		index = trashDoc(index, "d1", NOW);
		expect(usedSheets(index)).toBe(0);
	});
});

describe("완전 삭제", () => {
	it("폴더를 지우면 그 아래 것들도 함께 간다", () => {
		const { index, 신춘문예, 감나무 } = sample();
		const trashed = trashFolder(index, 신춘문예.id, NOW);
		// 폴더 3 + 원고 1이 휴지통에 있다
		expect(trashed.trash).toHaveLength(4);

		const { index: next, removedDocIds } = purge(trashed, [신춘문예.id]);

		// 하나도 남지 않는다. 남기면 갈 곳 없는 항목이 된다
		expect(next.trash).toHaveLength(0);
		// 본문을 지울 원고를 빠짐없이 알려 준다 — 목록이 "원고 1편"이라 적어 둔 그것이다
		expect(removedDocIds).toEqual([감나무.id]);
	});

	it("가운데 폴더만 지우면 그 위는 남는다", () => {
		const { index, 신춘문예, y2026, 초고, 감나무 } = sample();
		const trashed = trashFolder(index, 신춘문예.id, NOW);

		const { index: next, removedDocIds } = purge(trashed, [y2026.id]);

		expect(next.trash.map((t) => t.id)).toEqual([신춘문예.id]);
		expect(removedDocIds).toEqual([감나무.id]);
		expect(next.trash.some((t) => t.id === 초고.id)).toBe(false);
	});

	it("원고 하나만 지우면 그것만 간다", () => {
		const { index, 감나무 } = sample();
		const trashed = trashDoc(index, 감나무.id, NOW);

		const { index: next, removedDocIds } = purge(trashed, [감나무.id]);

		expect(next.trash).toHaveLength(0);
		expect(removedDocIds).toEqual([감나무.id]);
	});
});
