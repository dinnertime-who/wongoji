import { describe, expect, it } from "vitest";
import { fullPath, ROOT } from "../lib/path";
import { createDoc, createFolder, trashFolder } from "./operations";
import { applyOp } from "./ops";
import { emptyIndex } from "./types";

const NOW = 1_700_000_000_000;

/** id를 예측 가능하게 만들어 준다 */
function seq(prefix: string) {
	let n = 0;
	return () => `${prefix}${++n}`;
}

/**
 * 신춘문예 / 2026
 *              └ 감나무 (원고)
 * 루트에 원고 하나
 */
function sample() {
	const ids = seq("f");
	let index = emptyIndex();
	const a = createFolder(index, "신춘문예", ROOT, ids);
	index = a.index;
	const b = createFolder(index, "2026", fullPath(a.folder), ids);
	index = b.index;

	const docIds = seq("d");
	const d1 = createDoc(
		index,
		{ title: "감나무", path: fullPath(b.folder), now: NOW },
		docIds,
	);
	index = d1.index;
	const d2 = createDoc(index, { title: "루트 원고", path: ROOT, now: NOW });
	index = d2.index;

	return {
		index,
		신춘문예: a.folder,
		y2026: b.folder,
		감나무: d1.doc,
		루트원고: d2.doc,
	};
}

const ctx = { now: NOW, newId: seq("새") };

describe("연산 적용", () => {
	it("만든 원고를 알려 준다 — 본문을 만들어 주어야 하므로", () => {
		const { index } = sample();
		const effect = applyOp(index, { kind: "createDoc", path: ROOT }, ctx);

		expect(effect.createdDocId).toBeTruthy();
		expect(effect.index.docs).toHaveLength(3);
		expect(effect.index.docs.some((d) => d.id === effect.createdDocId)).toBe(
			true,
		);
	});

	it("복제는 원본까지 알려 준다 — 그 본문을 베껴야 하므로", () => {
		const { index, 감나무 } = sample();
		const effect = applyOp(index, { kind: "duplicateDoc", id: 감나무.id }, ctx);

		expect(effect.copiedFrom).toBe(감나무.id);
		expect(effect.createdDocId).toBeTruthy();
		expect(
			effect.index.docs.find((d) => d.id === effect.createdDocId)?.title,
		).toBe("감나무 (사본)");
	});

	it("완전 삭제는 본문을 지울 원고를 알려 준다", () => {
		const { index, 감나무 } = sample();
		const trashed = applyOp(index, { kind: "trashDoc", id: 감나무.id }, ctx);

		const purged = applyOp(
			trashed.index,
			{ kind: "purge", ids: [감나무.id] },
			ctx,
		);

		expect(purged.index.trash).toHaveLength(0);
		expect(purged.removedDocIds).toEqual([감나무.id]);
	});

	it("휴지통 비우기는 폴더가 데려간 원고까지 지운다", () => {
		const { index, 신춘문예, 감나무, 루트원고 } = sample();
		let next = trashFolder(index, 신춘문예.id, NOW);
		next = applyOp(next, { kind: "trashDoc", id: 루트원고.id }, ctx).index;
		// 폴더 2 + 원고 2
		expect(next.trash).toHaveLength(4);

		const emptied = applyOp(next, { kind: "purgeAll" }, ctx);

		expect(emptied.index.trash).toHaveLength(0);
		expect([...emptied.removedDocIds].sort()).toEqual(
			[감나무.id, 루트원고.id].sort(),
		);
	});

	it("되살리기는 본문을 건드리지 않는다 — 지운 적이 없다", () => {
		const { index, 감나무 } = sample();
		const trashed = applyOp(index, { kind: "trashDoc", id: 감나무.id }, ctx);
		const back = applyOp(
			trashed.index,
			{ kind: "restore", id: 감나무.id },
			ctx,
		);

		expect(back.removedDocIds).toEqual([]);
		expect(back.index.docs.some((d) => d.id === 감나무.id)).toBe(true);
	});

	it("분량만 고칠 때는 수정 시각을 올리지 않는다", () => {
		const { index, 감나무 } = sample();
		const effect = applyOp(
			index,
			{
				kind: "updateDoc",
				id: 감나무.id,
				patch: { chars: 120, sheets: 2 },
				touch: false,
			},
			{ now: NOW + 5000, newId: seq("새") },
		);

		const doc = effect.index.docs.find((d) => d.id === 감나무.id);
		expect(doc?.chars).toBe(120);
		// 읽기만 했는데 목록 맨 위로 올라오면 "최근 수정순"이 거짓말이 된다
		expect(doc?.updatedAt).toBe(NOW);
	});

	it("제목을 고치면 수정 시각이 올라간다", () => {
		const { index, 감나무 } = sample();
		const effect = applyOp(
			index,
			{
				kind: "updateDoc",
				id: 감나무.id,
				patch: { title: "감나무 있는 마당" },
			},
			{ now: NOW + 5000, newId: seq("새") },
		);

		expect(effect.index.docs.find((d) => d.id === 감나무.id)?.updatedAt).toBe(
			NOW + 5000,
		);
	});

	it("없는 대상에는 아무 일도 하지 않는다", () => {
		const { index } = sample();

		for (const op of [
			{ kind: "trashDoc", id: "없다" },
			{ kind: "trashFolder", id: "없다" },
			{ kind: "restore", id: "없다" },
			{ kind: "duplicateDoc", id: "없다" },
			{ kind: "renameFolder", id: "없다", name: "무엇" },
		] as const) {
			const effect = applyOp(index, op, ctx);
			// 같은 객체여야 한다. 새 객체를 주면 부르는 쪽이 그것을 저장한다
			expect(effect.index).toBe(index);
			expect(effect.removedDocIds).toEqual([]);
		}
	});

	it("한 칸 밀기도 연산이다 — 형제 목록은 서버가 제 색인에서 본다", () => {
		const { index, 감나무, 루트원고 } = sample();
		const 둘째 = applyOp(index, { kind: "createDoc", path: ROOT }, ctx);
		const moved = applyOp(
			둘째.index,
			{
				kind: "nudgeEntry",
				moving: { kind: "doc", id: 둘째.createdDocId ?? "" },
				dir: -1,
			},
			ctx,
		);

		const 루트 = moved.index.docs
			.filter((d) => d.path === ROOT)
			.sort((a, b) => a.order - b.order)
			.map((d) => d.id);
		expect(루트).toEqual([둘째.createdDocId, 루트원고.id]);
		expect(감나무.path).not.toBe(ROOT);
	});
});

describe("같은 함수를 서버와 브라우저가 부른다", () => {
	it("같은 색인·같은 연산이면 같은 결과다 — 낙관적 갱신이 어긋날 수 없는 근거", () => {
		const { index, 감나무 } = sample();
		const op = { kind: "trashDoc", id: 감나무.id } as const;

		const 서버 = applyOp(index, op, { now: NOW, newId: seq("s") });
		const 브라우저 = applyOp(index, op, { now: NOW, newId: seq("c") });

		expect(브라우저.index).toEqual(서버.index);
	});

	it("id를 만드는 연산만 서버 것으로 바로잡으면 된다", () => {
		const { index } = sample();
		const op = { kind: "createDoc", path: ROOT } as const;

		const 서버 = applyOp(index, op, { now: NOW, newId: () => "서버가만든것" });
		const 브라우저 = applyOp(index, op, { now: NOW, newId: () => "임시" });

		expect(서버.createdDocId).toBe("서버가만든것");
		expect(브라우저.createdDocId).toBe("임시");
		// 그 하나를 빼면 나머지는 같다
		expect(브라우저.index.docs).toHaveLength(서버.index.docs.length);
	});
});
