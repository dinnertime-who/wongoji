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
	nudgeEntry,
	placeEntry,
	purge,
	remapIds,
	restore,
	trashDoc,
	trashFolder,
	updateDoc,
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

	it("폴더가 먼저 온다", () => {
		const { index } = sample();
		const kids = childrenOf(index, ROOT);
		expect(kids.folders.map((f) => f.name)).toEqual(["신춘문예"]);
		expect(kids.docs).toHaveLength(1);
	});
});

/** 그 자리 형제들을 보이는 차례대로 */
const folderNames = (index: StoreIndex, path: string) =>
	childrenOf(index, path).folders.map((f) => f.name);
const docTitles = (index: StoreIndex, path: string) =>
	childrenOf(index, path).docs.map((d) => d.title);

const toEnd = (path: string) => ({ path, before: null });

describe("옮기기", () => {
	it("폴더를 옮기면 그 아래 전부가 따라간다", () => {
		const { index, y2026, 감나무, 초고 } = sample();
		const next = placeEntry(
			index,
			{ kind: "folder", id: y2026.id },
			toEnd(ROOT),
		);

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
		expect(
			placeEntry(
				index,
				{ kind: "folder", id: 신춘문예.id },
				toEnd(fullPath(y2026)),
			),
		).toBe(index);
	});

	it("원고만 옮기면 경로가 바뀐다", () => {
		const { index, 감나무 } = sample();
		const next = placeEntry(index, { kind: "doc", id: 감나무.id }, toEnd(ROOT));
		expect(next.docs.find((d) => d.id === 감나무.id)?.path).toBe(ROOT);
	});

	it("옮겨 온 것은 그 자리 맨 끝에 붙는다", () => {
		const { index, 감나무 } = sample();
		const next = placeEntry(index, { kind: "doc", id: 감나무.id }, toEnd(ROOT));
		expect(docTitles(next, ROOT)).toEqual(["루트 원고", "감나무"]);
	});

	it("떠나온 자리도 다시 빽빽해진다", () => {
		let index = emptyIndex();
		const ids = seq("d");
		for (const title of ["가", "나", "다"]) {
			index = createDoc(index, { title, now: NOW }, ids).index;
		}
		const folder = createFolder(index, "폴더", ROOT, seq("f"));

		// 가운데 것을 폴더로 빼내면 남은 둘이 0·1이 되어야 한다
		const next = placeEntry(
			folder.index,
			{ kind: "doc", id: "d2" },
			toEnd(fullPath(folder.folder)),
		);
		expect(childrenOf(next, ROOT).docs.map((d) => [d.title, d.order])).toEqual([
			["가", 0],
			["다", 1],
		]);
	});
});

describe("차례", () => {
	/** 루트에 원고 넷 — 가·나·다·라 */
	function four() {
		let index = emptyIndex();
		const ids = seq("d");
		for (const title of ["가", "나", "다", "라"]) {
			index = createDoc(index, { title, now: NOW }, ids).index;
		}
		return index;
	}

	it("만든 차례대로 늘어선다 — 새것이 맨 끝이다", () => {
		expect(docTitles(four(), ROOT)).toEqual(["가", "나", "다", "라"]);
	});

	it("고쳐도 자리를 지킨다 — 최근 수정순이 아니다", () => {
		const index = updateDoc(four(), "d1", { chars: 100 }, NOW + 1000);
		expect(docTitles(index, ROOT)).toEqual(["가", "나", "다", "라"]);
	});

	it("어느 형제 앞으로 끼운다", () => {
		const next = placeEntry(
			four(),
			{ kind: "doc", id: "d4" },
			{
				path: ROOT,
				before: "d2",
			},
		);
		expect(docTitles(next, ROOT)).toEqual(["가", "라", "나", "다"]);
	});

	it("before가 null이면 맨 끝이다", () => {
		const next = placeEntry(four(), { kind: "doc", id: "d1" }, toEnd(ROOT));
		expect(docTitles(next, ROOT)).toEqual(["나", "다", "라", "가"]);
	});

	it("옮기고 나면 번호에 빈틈이 없다", () => {
		const next = placeEntry(
			four(),
			{ kind: "doc", id: "d4" },
			{
				path: ROOT,
				before: "d1",
			},
		);
		expect(childrenOf(next, ROOT).docs.map((d) => d.order)).toEqual([
			0, 1, 2, 3,
		]);
	});

	it("제 앞에 놓는 것은 제자리에 두는 것이다", () => {
		const index = four();
		expect(
			placeEntry(
				index,
				{ kind: "doc", id: "d2" },
				{
					path: ROOT,
					before: "d2",
				},
			),
		).toBe(index);
	});

	it("손대지 않은 항목은 같은 객체로 남는다", () => {
		const index = four();
		// 맨 뒤를 맨 앞으로 — 넷 다 번호가 바뀐다. 그래도 다른 자리는 그대로다
		const folder = createFolder(index, "폴더", ROOT, seq("f"));
		const next = placeEntry(
			folder.index,
			{ kind: "doc", id: "d4" },
			{
				path: ROOT,
				before: "d1",
			},
		);
		expect(next.folders[0]).toBe(folder.index.folders[0]);
	});

	it("폴더도 원고와 따로 센다", () => {
		let index = emptyIndex();
		const ids = seq("f");
		for (const name of ["나중", "먼저"]) {
			index = createFolder(index, name, ROOT, ids).index;
		}
		index = createDoc(index, { title: "원고", now: NOW }, seq("d")).index;

		// 이름순이 아니라 만든 차례다. 원고의 자리와도 겹치지 않는다
		expect(folderNames(index, ROOT)).toEqual(["나중", "먼저"]);
		expect(childrenOf(index, ROOT).folders.map((f) => f.order)).toEqual([0, 1]);
		expect(childrenOf(index, ROOT).docs.map((d) => d.order)).toEqual([0]);
	});

	it("복제는 원본 바로 아래로 간다", () => {
		const index = four();
		const made = duplicateDoc(index, "d2", NOW, seq("c"));
		expect(docTitles(made?.index ?? index, ROOT)).toEqual([
			"가",
			"나",
			"나 (사본)",
			"다",
			"라",
		]);
	});
});

describe("한 칸 밀기", () => {
	function four() {
		let index = emptyIndex();
		const ids = seq("d");
		for (const title of ["가", "나", "다", "라"]) {
			index = createDoc(index, { title, now: NOW }, ids).index;
		}
		return index;
	}

	it("위로", () => {
		const next = nudgeEntry(four(), { kind: "doc", id: "d3" }, -1);
		expect(docTitles(next, ROOT)).toEqual(["가", "다", "나", "라"]);
	});

	it("아래로", () => {
		const next = nudgeEntry(four(), { kind: "doc", id: "d2" }, 1);
		expect(docTitles(next, ROOT)).toEqual(["가", "다", "나", "라"]);
	});

	it("마지막 바로 앞에서 아래로 밀면 맨 끝이 된다", () => {
		const next = nudgeEntry(four(), { kind: "doc", id: "d3" }, 1);
		expect(docTitles(next, ROOT)).toEqual(["가", "나", "라", "다"]);
	});

	it("양 끝에서 더 밀면 아무 일도 없다", () => {
		const index = four();
		expect(nudgeEntry(index, { kind: "doc", id: "d1" }, -1)).toBe(index);
		expect(nudgeEntry(index, { kind: "doc", id: "d4" }, 1)).toBe(index);
	});

	it("다른 폴더의 것과는 섞이지 않는다", () => {
		const made = createFolder(four(), "폴더", ROOT, seq("f"));
		let index = createDoc(
			made.index,
			{ title: "안쪽", path: fullPath(made.folder), now: NOW },
			seq("x"),
		).index;

		// 폴더 안에 하나뿐이니 밀 곳이 없다
		index = nudgeEntry(index, { kind: "doc", id: "x1" }, -1);
		expect(docTitles(index, fullPath(made.folder))).toEqual(["안쪽"]);
		expect(docTitles(index, ROOT)).toEqual(["가", "나", "다", "라"]);
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
		// 폴더를 영영 지운다 — 아래 것들이 함께 간다
		next = purge(next, [신춘문예.id]).index;

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

	/*
	 * 30일이 지난 것을 비우는 일은 여기 없다. 서버가 보관함을 돌려주기 전에
	 * 한다(`sweepExpired`) — 브라우저가 비우면 그 사실이 서버로 갈 길이 없어서
	 * 다음에 받아 올 때 그대로 되살아났다.
	 */

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

describe("계정으로 올릴 때 id 다시 매기기", () => {
	const 순번 = () => {
		let n = 0;
		return () => `새${++n}`;
	};

	it("겹치지 않으면 그대로 둔다 — 대개는 아무 일도 없다", () => {
		const { index } = createDoc(emptyIndex(), { title: "감나무" });
		const out = remapIds(index, new Set(["남의것"]), 순번());

		expect(out.renamed.size).toBe(0);
		expect(out.index).toBe(index);
	});

	it("겹치는 것만 새 id를 받는다", () => {
		const a = createDoc(emptyIndex(), { title: "가" }, () => "겹침");
		const b = createDoc(a.index, { title: "나" }, () => "안겹침");

		const out = remapIds(b.index, new Set(["겹침"]), 순번());

		expect(out.renamed.get("겹침")).toBe("새1");
		expect(out.renamed.has("안겹침")).toBe(false);
		expect(out.index.docs.map((d) => d.id).sort()).toEqual(["새1", "안겹침"]);
	});

	/*
	 * 이것이 이 함수의 존재 이유다. 폴더 id는 경로 문자열 안에 박혀 있어서,
	 * 폴더만 새 id를 받고 경로를 그대로 두면 그 아래 원고가 사라진 폴더를
	 * 가리킨 채로 계정에 올라간다 — 화면에서 영영 보이지 않는다.
	 */
	it("폴더 id가 바뀌면 그 아래 경로도 함께 바뀐다", () => {
		const f = createFolder(emptyIndex(), "단편", ROOT, () => "겹침");
		const d = createDoc(f.index, { path: fullPath(f.folder) }, () => "원고");

		const out = remapIds(d.index, new Set(["겹침"]), 순번());

		expect(out.index.folders[0].id).toBe("새1");
		expect(out.index.docs[0].path).toBe("/새1/");
	});

	it("두 겹 폴더도 사슬째 따라간다", () => {
		const 위 = createFolder(emptyIndex(), "위", ROOT, () => "겹침1");
		const 아래 = createFolder(
			위.index,
			"아래",
			fullPath(위.folder),
			() => "겹침2",
		);
		const d = createDoc(
			아래.index,
			{ path: fullPath(아래.folder) },
			() => "원고",
		);

		const out = remapIds(d.index, new Set(["겹침1", "겹침2"]), 순번());

		expect(out.index.docs[0].path).toBe("/새1/새2/");
	});

	it("새로 뽑은 id가 또 겹치면 다시 뽑는다", () => {
		const { index } = createDoc(emptyIndex(), {}, () => "겹침");
		const out = remapIds(index, new Set(["겹침", "새1", "새2"]), 순번());

		expect(out.renamed.get("겹침")).toBe("새3");
	});

	it("휴지통에 있는 것도 함께 매긴다 — 되살릴 것이다", () => {
		const { index } = createDoc(
			emptyIndex(),
			{ title: "감나무" },
			() => "겹침",
		);
		const trashed = trashDoc(index, "겹침");

		const out = remapIds(trashed, new Set(["겹침"]), 순번());

		expect(out.index.trash[0].id).toBe("새1");
	});

	it("한 번에 여러 벌이 겹쳐도 서로 부딪히지 않는다", () => {
		const a = createDoc(emptyIndex(), {}, () => "가");
		const b = createDoc(a.index, {}, () => "나");
		const c = createDoc(b.index, {}, () => "다");

		const out = remapIds(c.index, new Set(["가", "나", "다"]), 순번());

		const ids = out.index.docs.map((d) => d.id);
		expect(new Set(ids).size).toBe(3);
		expect(ids.sort()).toEqual(["새1", "새2", "새3"]);
	});
});
