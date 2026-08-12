import { describe, expect, it } from "vitest";
import { upgradeIndex } from "./migrate";
import { emptyIndex } from "./types";

const NOW = 1_700_000_000_000;

/**
 * order가 없던 시절의 색인.
 *
 * 그때 화면은 폴더를 이름순, 원고를 최근 수정순으로 늘어놓았다. 배열에 담긴
 * 차례는 정렬과 무관했다 — 만든 차례 그대로 뒤에 붙기만 했다.
 */
const v1 = () => ({
	version: 1,
	folders: [
		{ id: "f2", name: "습작", path: "/" },
		{ id: "f1", name: "2026", path: "/" },
		{ id: "f3", name: "안쪽", path: "/f1/" },
	],
	docs: [
		{ ...doc("d1", "오래된"), updatedAt: NOW - 2000 },
		{ ...doc("d2", "최근"), updatedAt: NOW },
		{ ...doc("d3", "가운데"), updatedAt: NOW - 1000 },
	],
	trash: [],
});

const doc = (id: string, title: string) => ({
	id,
	title,
	path: "/",
	goal: 0,
	chars: 0,
	sheets: 1,
	createdAt: NOW,
	updatedAt: NOW,
});

describe("색인 판 올리기", () => {
	it("지금 판은 그대로 지나간다", () => {
		const index = emptyIndex();
		expect(upgradeIndex(index)).toEqual(index);
	});

	it("1판을 올리면 판 번호가 2가 된다", () => {
		expect(upgradeIndex(v1())?.version).toBe(2);
	});

	it("올린 순간 목록에서 아무것도 움직이지 않는다", () => {
		const index = upgradeIndex(v1());
		if (!index) throw new Error("올리지 못했다");

		// 폴더는 이름순이었다
		const root = index.folders
			.filter((f) => f.path === "/")
			.sort((a, b) => a.order - b.order);
		expect(root.map((f) => f.name)).toEqual(["2026", "습작"]);

		// 원고는 최근 수정순이었다
		expect(
			[...index.docs].sort((a, b) => a.order - b.order).map((d) => d.title),
		).toEqual(["최근", "가운데", "오래된"]);
	});

	it("자리마다 따로 센다 — 폴더 안쪽도 0부터", () => {
		const index = upgradeIndex(v1());
		expect(index?.folders.find((f) => f.id === "f3")?.order).toBe(0);
	});

	it("없던 배열은 빈 배열로 메운다", () => {
		// folders도 trash도 없던 때의 색인이 남아 있을 수 있다
		const index = upgradeIndex({ version: 1, docs: [doc("d1", "혼자")] });
		expect(index?.folders).toEqual([]);
		expect(index?.trash).toEqual([]);
		expect(index?.docs).toHaveLength(1);
	});

	it("모르는 판은 짐작해서 고치지 않는다", () => {
		// 우리보다 새것일 수 있다. 반쯤 읽어 덮어쓰는 편이 더 나쁘다
		expect(upgradeIndex({ version: 99, docs: [] })).toBeNull();
	});

	it("색인 모양이 아니면 null이다", () => {
		expect(upgradeIndex(null)).toBeNull();
		expect(upgradeIndex("문자열")).toBeNull();
		expect(upgradeIndex({ version: 2 })).toBeNull();
	});
});
