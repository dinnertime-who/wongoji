import { describe, expect, it } from "vitest";
import type { FolderEntry } from "../model/types";
import {
	ancestorIds,
	canMoveFolder,
	fullPath,
	isUnder,
	pathNames,
	ROOT,
	settleUnder,
} from "./path";

/**
 * 폴더 트리를 경로 문자열로 다룬다(materialized path).
 *
 * 트리가 끊기면 원고가 화면에서 영영 사라진다 — 목록에는 있는데 어느 폴더를
 * 열어도 안 나온다. 여기 있는 규칙 둘이 그것을 막는다: 순환을 만들지 않는
 * `canMoveFolder`와, 사라진 조상을 잘라 내는 `settleUnder`.
 */

const folder = (id: string, name: string, path = ROOT): FolderEntry => ({
	id,
	name,
	path,
	order: 0,
});

describe("경로 읽기", () => {
	it("자기 id를 붙여야 자손을 찾을 수 있다", () => {
		// `path`는 조상들만 담는다. 자손과 견주려면 자기를 붙인 것이어야 한다
		expect(fullPath({ id: "f2", path: "/f1/" })).toBe("/f1/f2/");
		expect(fullPath({ id: "f1", path: ROOT })).toBe("/f1/");
	});

	it("조상을 위에서부터 늘어놓는다 — 브레드크럼이 이것이다", () => {
		expect(ancestorIds("/f1/f2/f3/")).toEqual(["f1", "f2", "f3"]);
	});

	it("root에는 조상이 없다", () => {
		expect(ancestorIds(ROOT)).toEqual([]);
		expect(ancestorIds("")).toEqual([]);
	});

	it("아래에 있는지 본다", () => {
		expect(isUnder("/f1/f2/", "/f1/")).toBe(true);
		expect(isUnder("/f1/", "/f1/")).toBe(true);
		expect(isUnder("/g1/", "/f1/")).toBe(false);
	});
});

describe("폴더를 옮길 수 있는가", () => {
	const f1 = folder("f1", "소설");

	it("자기 안으로는 옮길 수 없다", () => {
		expect(canMoveFolder(f1, fullPath(f1))).toBe(false);
	});

	it("자기 자손 안으로는 옮길 수 없다 — 순환이 생겨 트리가 끊긴다", () => {
		expect(canMoveFolder(f1, "/f1/f2/")).toBe(false);
		expect(canMoveFolder(f1, "/f1/f2/f3/")).toBe(false);
	});

	it("형제나 바깥으로는 옮길 수 있다", () => {
		expect(canMoveFolder(f1, ROOT)).toBe(true);
		expect(canMoveFolder(f1, "/g1/")).toBe(true);
	});

	it("id 앞머리가 겹치는 남의 폴더와 헷갈리지 않는다", () => {
		/*
		 * `/f10/`은 `/f1/`의 자손이 아니다. 경로를 슬래시로 닫아 두는 이유가
		 * 이것이고, 닫지 않으면 이름이 비슷한 폴더로 못 옮기게 된다.
		 */
		expect(canMoveFolder(f1, "/f10/")).toBe(true);
	});

	it("깊은 곳에 있는 폴더도 같은 규칙이다", () => {
		const 깊은것 = folder("f3", "단편", "/f1/f2/");
		expect(canMoveFolder(깊은것, "/f1/f2/f3/f4/")).toBe(false);
		expect(canMoveFolder(깊은것, "/f1/")).toBe(true);
	});
});

describe("사라진 조상 잘라 내기", () => {
	it("전부 살아 있으면 그대로 둔다", () => {
		expect(settleUnder("/f1/f2/", new Set(["f1", "f2"]))).toBe("/f1/f2/");
	});

	it("중간이 사라졌으면 거기서 멈춘다", () => {
		// f2가 없다. f1까지가 실제로 갈 수 있는 곳이다
		expect(settleUnder("/f1/f2/f3/", new Set(["f1", "f3"]))).toBe("/f1/");
	});

	it("맨 위가 사라졌으면 root로 올린다", () => {
		/*
		 * **여기가 원고를 잃지 않게 하는 자리다.** 그대로 두면 없는 폴더 아래에
		 * 남아 어느 화면에서도 보이지 않는다.
		 */
		expect(settleUnder("/f1/f2/", new Set(["f2"]))).toBe(ROOT);
	});

	it("살아 있는 것이 하나도 없으면 root다", () => {
		expect(settleUnder("/f1/f2/", new Set())).toBe(ROOT);
	});

	it("root는 언제나 root다", () => {
		expect(settleUnder(ROOT, new Set())).toBe(ROOT);
	});

	it("무엇이 살아 있는지는 부르는 쪽이 정한다", () => {
		// 휴지통에서 되살릴 때는 함께 돌아오는 폴더도 살아 있는 것이다
		expect(settleUnder("/f1/f2/", new Set(["f1", "f2"]))).toBe("/f1/f2/");
		expect(settleUnder("/f1/f2/", new Set(["f1"]))).toBe("/f1/");
	});
});

describe("경로를 이름으로", () => {
	const folders = [
		folder("f1", "소설"),
		folder("f2", "단편", "/f1/"),
		folder("f3", "2026", "/f1/f2/"),
	];

	it("위에서부터 이름을 늘어놓는다", () => {
		expect(pathNames("/f1/f2/f3/", folders)).toEqual(["소설", "단편", "2026"]);
	});

	it("중간에 사라진 폴더가 있으면 거기서 멈춘다", () => {
		expect(pathNames("/f1/없는것/f3/", folders)).toEqual(["소설"]);
	});

	it("root는 빈 목록이다", () => {
		expect(pathNames(ROOT, folders)).toEqual([]);
	});
});
