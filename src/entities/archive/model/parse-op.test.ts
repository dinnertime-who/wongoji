import { describe, expect, it } from "vitest";
import { parseOp } from "./parse-op";

/**
 * 보관함의 유일한 관문.
 *
 * 평소의 고치기가 전부 이 길로 오므로, 여기를 지난 값은 무엇이든 색인을 다시
 * 쓴다. **여기서 새면 순수 함수가 도중에 터져 절반만 쓰인 색인이 남거나, 남이
 * 보낸 `path`가 원고를 엉뚱한 폴더로 데려간다.**
 */

describe("연산이 아닌 것", () => {
	it("아무것도 아니면 받지 않는다", () => {
		expect(parseOp(null)).toBeNull();
		expect(parseOp(undefined)).toBeNull();
		expect(parseOp("purgeAll")).toBeNull();
		expect(parseOp(42)).toBeNull();
		expect(parseOp([])).toBeNull();
	});

	it("모르는 종류는 받지 않는다", () => {
		expect(parseOp({ kind: "dropDatabase" })).toBeNull();
		expect(parseOp({})).toBeNull();
	});
});

describe("만들기", () => {
	it("자리는 있어야 한다", () => {
		expect(parseOp({ kind: "createDoc", path: "/" })).toEqual({
			kind: "createDoc",
			path: "/",
			title: undefined,
		});
		expect(parseOp({ kind: "createDoc" })).toBeNull();
		expect(parseOp({ kind: "createDoc", path: 1 })).toBeNull();
	});

	it("제목은 있어도 되고 없어도 되지만 글자여야 한다", () => {
		expect(parseOp({ kind: "createDoc", path: "/", title: "제목" })).toEqual({
			kind: "createDoc",
			path: "/",
			title: "제목",
		});
		expect(parseOp({ kind: "createDoc", path: "/", title: 1 })).toBeNull();
	});

	it("폴더는 이름과 자리가 둘 다 있어야 한다", () => {
		expect(parseOp({ kind: "createFolder", name: "소설", path: "/" })).toEqual({
			kind: "createFolder",
			name: "소설",
			path: "/",
		});
		expect(parseOp({ kind: "createFolder", name: "소설" })).toBeNull();
		expect(parseOp({ kind: "createFolder", path: "/" })).toBeNull();
	});
});

describe("원고 고치기", () => {
	it("고칠 수 있는 칸만 통과한다", () => {
		expect(
			parseOp({
				kind: "updateDoc",
				id: "d1",
				patch: { title: "제목", goal: 70, chars: 1200, sheets: 7 },
			}),
		).toEqual({
			kind: "updateDoc",
			id: "d1",
			patch: { title: "제목", goal: 70, chars: 1200, sheets: 7 },
			touch: true,
		});
	});

	it("자리를 옮기는 칸은 걸러 낸다", () => {
		/*
		 * **여기가 이 파일의 이유다.** 패치는 원고 줄에 그대로 펼쳐 얹히므로,
		 * `path`가 섞여 들면 남의 폴더로 원고가 간다. 옮기는 길은 `placeEntry`
		 * 하나여야 한다.
		 */
		const 통과 = parseOp({
			kind: "updateDoc",
			id: "d1",
			patch: { title: "제목", path: "/남의폴더/", order: 0, id: "다른원고" },
		});
		expect(통과).toEqual({
			kind: "updateDoc",
			id: "d1",
			patch: { title: "제목" },
			touch: true,
		});
	});

	it("상태는 정해 둔 셋 중 하나뿐이다", () => {
		for (const status of ["draft", "revising", "done"]) {
			expect(
				parseOp({ kind: "updateDoc", id: "d1", patch: { status } }),
			).toMatchObject({ patch: { status } });
		}
		// 화면이 모르는 뱃지가 목록에 뜬다
		expect(
			parseOp({ kind: "updateDoc", id: "d1", patch: { status: "제출" } }),
		).toBeNull();
	});

	it("상태를 비우는 길은 없다", () => {
		// 빈 것은 초고로 읽으므로 적어 넣는 것과 뜻이 같고, 길이 둘이면
		// 어느 쪽으로 왔느냐에 따라 `statusAt`이 달라진다
		expect(
			parseOp({ kind: "updateDoc", id: "d1", patch: { status: null } }),
		).toBeNull();
	});

	it("숫자 칸은 유한한 0 이상이어야 한다", () => {
		for (const key of ["goal", "chars", "sheets"]) {
			expect(
				parseOp({ kind: "updateDoc", id: "d1", patch: { [key]: -1 } }),
			).toBeNull();
			expect(
				parseOp({ kind: "updateDoc", id: "d1", patch: { [key]: Number.NaN } }),
			).toBeNull();
			expect(
				parseOp({
					kind: "updateDoc",
					id: "d1",
					patch: { [key]: Number.POSITIVE_INFINITY },
				}),
			).toBeNull();
			expect(
				parseOp({ kind: "updateDoc", id: "d1", patch: { [key]: "70" } }),
			).toBeNull();
			expect(
				parseOp({ kind: "updateDoc", id: "d1", patch: { [key]: 0 } }),
			).toMatchObject({ patch: { [key]: 0 } });
		}
	});

	it("빈 패치도 패치다", () => {
		expect(parseOp({ kind: "updateDoc", id: "d1", patch: {} })).toMatchObject({
			patch: {},
		});
	});

	it("패치가 없거나 객체가 아니면 받지 않는다", () => {
		expect(parseOp({ kind: "updateDoc", id: "d1" })).toBeNull();
		expect(parseOp({ kind: "updateDoc", id: "d1", patch: "제목" })).toBeNull();
		expect(parseOp({ kind: "updateDoc", patch: {} })).toBeNull();
	});

	it("touch는 없으면 참이고, 거짓만 거짓이다", () => {
		// 읽기만 했는데 목록에서 맨 위로 올라오면 "최근 수정순"이 거짓말이 된다
		const touch = (v: unknown) =>
			parseOp({ kind: "updateDoc", id: "d1", patch: {}, touch: v });
		expect(touch(undefined)).toMatchObject({ touch: true });
		expect(touch(false)).toMatchObject({ touch: false });
		expect(touch(true)).toMatchObject({ touch: true });
		// 모양이 틀린 값으로 조용히 거짓이 되지는 않는다
		expect(touch("no")).toMatchObject({ touch: true });
	});
});

describe("자리 옮기기", () => {
	const moving = { kind: "doc", id: "d1" };
	const to = { path: "/f1/", before: null };

	it("무엇을 어디로인지 둘 다 있어야 한다", () => {
		expect(parseOp({ kind: "placeEntry", moving, to })).toEqual({
			kind: "placeEntry",
			moving,
			to,
		});
		expect(parseOp({ kind: "placeEntry", moving })).toBeNull();
		expect(parseOp({ kind: "placeEntry", to })).toBeNull();
	});

	it("옮기는 것은 원고나 폴더뿐이다", () => {
		expect(
			parseOp({ kind: "placeEntry", moving: { kind: "trash", id: "t1" }, to }),
		).toBeNull();
		expect(
			parseOp({ kind: "placeEntry", moving: { kind: "doc", id: 1 }, to }),
		).toBeNull();
	});

	it("앞에 놓을 것은 글자이거나 없음이다", () => {
		expect(
			parseOp({
				kind: "placeEntry",
				moving,
				to: { path: "/", before: "d2" },
			}),
		).toMatchObject({ to: { before: "d2" } });
		// 없으면(undefined) 맨 끝인지 아닌지를 알 수 없다. null로 적어야 한다
		expect(
			parseOp({ kind: "placeEntry", moving, to: { path: "/" } }),
		).toBeNull();
	});

	it("미는 방향은 위나 아래뿐이다", () => {
		expect(parseOp({ kind: "nudgeEntry", moving, dir: -1 })).toMatchObject({
			dir: -1,
		});
		expect(parseOp({ kind: "nudgeEntry", moving, dir: 1 })).toMatchObject({
			dir: 1,
		});
		expect(parseOp({ kind: "nudgeEntry", moving, dir: 0 })).toBeNull();
		expect(parseOp({ kind: "nudgeEntry", moving, dir: 2 })).toBeNull();
		expect(parseOp({ kind: "nudgeEntry", moving, dir: "1" })).toBeNull();
	});
});

describe("버리기와 지우기", () => {
	it("id 하나를 받는 것들", () => {
		for (const kind of ["duplicateDoc", "trashDoc", "trashFolder", "restore"]) {
			expect(parseOp({ kind, id: "x1" })).toEqual({ kind, id: "x1" });
			expect(parseOp({ kind })).toBeNull();
			expect(parseOp({ kind, id: 1 })).toBeNull();
		}
	});

	it("완전 삭제는 id 목록을 받는다", () => {
		expect(parseOp({ kind: "purge", ids: ["a", "b"] })).toEqual({
			kind: "purge",
			ids: ["a", "b"],
		});
		expect(parseOp({ kind: "purge", ids: [] })).toEqual({
			kind: "purge",
			ids: [],
		});
	});

	it("목록에 글자 아닌 것이 하나라도 있으면 받지 않는다", () => {
		// 되돌릴 수 없는 일이다. 반쯤 알아들은 채로 지우지 않는다
		expect(parseOp({ kind: "purge", ids: ["a", 1] })).toBeNull();
		expect(parseOp({ kind: "purge", ids: "a" })).toBeNull();
		expect(parseOp({ kind: "purge" })).toBeNull();
	});

	it("전부 비우기는 더 받을 것이 없다", () => {
		expect(parseOp({ kind: "purgeAll" })).toEqual({ kind: "purgeAll" });
		// 곁다리로 딸려 온 것은 그냥 버린다
		expect(parseOp({ kind: "purgeAll", ids: ["a"] })).toEqual({
			kind: "purgeAll",
		});
	});
});
