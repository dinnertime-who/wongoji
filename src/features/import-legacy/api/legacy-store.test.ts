import "fake-indexeddb/auto";
import { createStore, set } from "idb-keyval";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearLegacy,
	listAccountBodies,
	readLegacyDoc,
	readLegacyIndex,
} from "./legacy-store";

/**
 * 로그인이 없던 시절의 저장소.
 *
 * **읽는 데 실패해도 던지지 않는다.** 여기서 던지면 로그인하는 길이 통째로
 * 막힌다 — 옛 원고를 옮기려다 계정을 못 쓰게 되는 셈이다. 못 읽은 것은 빈
 * 색인으로 돌려주고, 옮기지 못한 것을 두고 가는 쪽이 그다음으로 나쁜 결과다.
 */

const INDEX = "wongoji:v1:index";
const legacy = createStore("wongoji", "docs");

function fakeStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		key: (i: number) => [...map.keys()][i] ?? null,
		getItem: (k: string) => map.get(k) ?? null,
		removeItem: (k: string) => void map.delete(k),
		setItem: (k: string, v: string) => void map.set(k, v),
	};
}

let storage: Storage;

beforeEach(() => {
	storage = fakeStorage();
	vi.stubGlobal("window", { localStorage: storage });
});

afterEach(async () => {
	vi.unstubAllGlobals();
	await clearLegacy().catch(() => {});
});

describe("옛 목록 읽기", () => {
	it("없으면 빈 색인이다", () => {
		expect(readLegacyIndex()).toEqual({
			version: 2,
			folders: [],
			docs: [],
			trash: [],
		});
	});

	it("깨진 글자여도 던지지 않는다", () => {
		// 던지면 옛 원고를 옮기려다 로그인 자체가 막힌다
		storage.setItem(INDEX, "{이건 JSON이 아니다");
		expect(readLegacyIndex().docs).toEqual([]);
	});

	it("우리가 모르는 판이면 빈 색인이다 — 짐작해서 고치지 않는다", () => {
		storage.setItem(INDEX, JSON.stringify({ version: 99, docs: [] }));
		expect(readLegacyIndex().docs).toEqual([]);
	});

	it("지금 판은 그대로 읽는다", () => {
		const index = {
			version: 2,
			folders: [],
			docs: [{ id: "d1", title: "제목", path: "/", order: 0 }],
			trash: [],
		};
		storage.setItem(INDEX, JSON.stringify(index));
		expect(readLegacyIndex().docs).toHaveLength(1);
	});

	it("옛 판(1판)은 올려서 준다 — 그때는 차례가 없었다", () => {
		storage.setItem(
			INDEX,
			JSON.stringify({
				version: 1,
				folders: [],
				docs: [
					{ id: "d1", title: "먼저 쓴 것", path: "/", updatedAt: 1 },
					{ id: "d2", title: "나중 쓴 것", path: "/", updatedAt: 2 },
				],
				trash: [],
			}),
		);

		const 올린것 = readLegacyIndex();
		expect(올린것.version).toBe(2);
		// 저장된 차례는 그대로 두고 번호만 얹는다 — 정렬은 읽는 쪽이 한다
		expect(올린것.docs.map((d) => d.id)).toEqual(["d1", "d2"]);
		// 그 판의 화면이 쓰던 정렬(최근 수정순)이 그대로 번호가 된다
		expect(올린것.docs.map((d) => d.order)).toEqual([1, 0]);
	});
});

describe("옛 본문 읽기", () => {
	it("IndexedDB에 있으면 그것이다", async () => {
		await set("d1", { text: "본문" }, legacy);
		expect(await readLegacyDoc("d1")).toEqual({ text: "본문" });
	});

	it("없으면 그보다 옛 자리를 한 번 더 본다", async () => {
		/*
		 * IndexedDB로 옮기기 전에는 본문이 localStorage에 있었고, 그 뒤로 앱을 한
		 * 번도 열지 않은 브라우저에는 아직 거기 남아 있다. **옮기지 못한 원고를
		 * 두고 가는 것이 여기서 제일 나쁜 결과**라 값싼 쪽을 한 번 더 본다.
		 */
		storage.setItem(
			"wongoji:v1:doc:옛것",
			JSON.stringify({ text: "더 옛 본문" }),
		);
		expect(await readLegacyDoc("옛것")).toEqual({ text: "더 옛 본문" });
	});

	it("둘 다 없으면 없는 것이다", async () => {
		expect(await readLegacyDoc("한번도없던것")).toBeNull();
	});

	it("읽어 낼 수 없는 글자는 글자 그대로 올린다", async () => {
		// 옛 평문 저장이다. 여기서 버리면 그 원고를 잃는다 — 읽는 쪽이 가린다
		storage.setItem("wongoji:v1:doc:평문", "그냥 글자로 저장되던 시절");
		expect(await readLegacyDoc("평문")).toBe("그냥 글자로 저장되던 시절");
	});
});

describe("계정 칸에 남은 본문", () => {
	it("그 계정 칸만 훑는다", async () => {
		await set("d1", { text: "내 본문" }, createStore("wongoji:u:u1", "docs"));
		await set("d2", { text: "남의 본문" }, createStore("wongoji:u:u2", "docs"));

		expect(await listAccountBodies("u1")).toEqual([
			{ id: "d1", content: { text: "내 본문" } },
		]);
	});

	it("빈 칸이면 빈 목록이다", async () => {
		expect(await listAccountBodies("한번도없던계정")).toEqual([]);
	});
});

describe("다 옮긴 뒤 비우기", () => {
	it("목록도 본문도 지운다 — 남기면 사본이 둘이 되고 그때부터 갈라진다", async () => {
		storage.setItem(INDEX, JSON.stringify({ version: 2, docs: [] }));
		storage.setItem("wongoji:v1:last", "d1");
		await set("d1", { text: "본문" }, legacy);

		await clearLegacy();

		expect(storage.getItem(INDEX)).toBeNull();
		expect(storage.getItem("wongoji:v1:last")).toBeNull();
		expect(await readLegacyDoc("d1")).toBeNull();
	});
});
