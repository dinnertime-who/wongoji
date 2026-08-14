import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyIndex } from "#/entities/archive";
import {
	type DocVersion,
	fetchVersions,
	onDocRestored,
	restoreVersion,
	versionsQueryKey,
} from "./version-api";

/**
 * 원고의 이력과 되돌리기.
 *
 * **되돌린 뒤에 알리는 것이 핵심이다.** 서버의 본문이 갈렸는데 에디터는 "이미
 * 앉힌 원고는 다시 앉히지 않는다"고 정해 두어서, 알려 주지 않으면 화면에 옛 글이
 * 그대로 남고 다음 타이핑에 그것이 되살아난다 — 되돌린 것이 없던 일이 된다.
 */

const 응답 = (body: unknown, status = 200): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	}) as Response;

const version: DocVersion = {
	id: "v1",
	kind: "status",
	status: "done",
	title: "감나무 있는 마당",
	excerpt: "마당에는 감나무가",
	chars: 1200,
	sheets: 7,
	createdAt: 0,
};

const fetchMock = vi.fn<typeof fetch>();
/** 테스트마다 붙였다 뗀다. 듣는 이는 모듈에 남는다 */
let 구독해제: (() => void)[] = [];

const 듣는다 = (listener: (docId: string) => void) => {
	구독해제.push(onDocRestored(listener));
};

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	for (const off of 구독해제) off();
	구독해제 = [];
	vi.unstubAllGlobals();
});

describe("이력 받기", () => {
	it("서버가 준 목록을 그대로 돌려준다", async () => {
		fetchMock.mockResolvedValue(응답({ versions: [version] }));
		expect(await fetchVersions("d1")).toEqual([version]);
	});

	it("주소에 든 id를 감싼다", async () => {
		// 원고 id는 cuid2라 안전하지만, 감싸지 않는 습관이 남으면 언젠가 샌다
		fetchMock.mockResolvedValue(응답({ versions: [] }));
		await fetchVersions("a/b");
		expect(fetchMock).toHaveBeenCalledWith("/api/archive/doc/a%2Fb/versions");
	});

	it("못 받으면 던진다", async () => {
		fetchMock.mockResolvedValue(응답(null, 500));
		await expect(fetchVersions("d1")).rejects.toThrow("500");
	});
});

describe("되돌리기", () => {
	it("고를 버전을 보내고 바뀐 색인을 받는다", async () => {
		const index = emptyIndex();
		fetchMock.mockResolvedValue(응답({ index }));

		expect(await restoreVersion("d1", "v1")).toEqual(index);

		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe("/api/archive/doc/d1/versions");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(String(init?.body))).toEqual({ versionId: "v1" });
	});

	it("되돌렸다고 알린다", async () => {
		const 들은것: string[] = [];
		듣는다((docId) => 들은것.push(docId));

		fetchMock.mockResolvedValue(응답({ index: emptyIndex() }));
		await restoreVersion("d1", "v1");

		expect(들은것).toEqual(["d1"]);
	});

	it("실패하면 알리지 않는다 — 갈린 것이 없다", async () => {
		const 들은것: string[] = [];
		듣는다((docId) => 들은것.push(docId));

		fetchMock.mockResolvedValue(응답(null, 404));
		await expect(restoreVersion("d1", "없는버전")).rejects.toThrow("404");

		expect(들은것).toEqual([]);
	});

	it("듣는 쪽이 넘어져도 되돌리기는 끝난다", async () => {
		/*
		 * 듣는 쪽 사정이다. 여기서 함께 넘어지면 이미 갈린 서버와 화면이
		 * 어긋난 채로 남는다.
		 */
		듣는다(() => {
			throw new Error("듣는 쪽이 넘어졌다");
		});
		const 들은것: string[] = [];
		듣는다((docId) => 들은것.push(docId));

		const index = emptyIndex();
		fetchMock.mockResolvedValue(응답({ index }));

		expect(await restoreVersion("d1", "v1")).toEqual(index);
		// 넘어진 쪽 다음 사람도 듣는다
		expect(들은것).toEqual(["d1"]);
	});

	it("구독을 놓으면 더 듣지 않는다", async () => {
		const 들은것: string[] = [];
		const off = onDocRestored((docId) => 들은것.push(docId));
		off();

		fetchMock.mockResolvedValue(응답({ index: emptyIndex() }));
		await restoreVersion("d1", "v1");

		expect(들은것).toEqual([]);
	});
});

describe("캐시 자리", () => {
	it("원고마다 갈라 둔다", () => {
		expect(versionsQueryKey("d1")).toEqual(["doc-versions", "d1"]);
		expect(versionsQueryKey("d2")).not.toEqual(versionsQueryKey("d1"));
	});
});
