import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArchiveOp } from "../model/ops";
import { emptyIndex } from "../model/types";
import { ARCHIVE_KEY, fetchArchive, sendOp } from "./archive-api";

/**
 * 계정 보관함과 주고받는 길.
 *
 * **실패를 삼키지 않는 것이 전부다.** 여기서 조용히 빈 색인을 돌려주면 화면은
 * "보관함이 비었다"고 보고, 홈은 그것을 보고 원고를 새로 만든다 — 서버에 원고가
 * 멀쩡히 있는데도.
 */

const 응답 = (body: unknown, status = 200): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	}) as Response;

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("보관함 받기", () => {
	it("서버가 준 색인을 그대로 돌려준다", async () => {
		const index = emptyIndex();
		fetchMock.mockResolvedValue(응답(index));

		expect(await fetchArchive()).toEqual(index);
		expect(fetchMock).toHaveBeenCalledWith("/api/archive");
	});

	it("서버가 거절하면 던진다 — 빈 색인으로 눙치지 않는다", async () => {
		fetchMock.mockResolvedValue(응답(null, 401));
		await expect(fetchArchive()).rejects.toThrow("401");
	});

	it("서버가 넘어져도 던진다", async () => {
		fetchMock.mockResolvedValue(응답(null, 500));
		await expect(fetchArchive()).rejects.toThrow("500");
	});
});

describe("연산 보내기", () => {
	const op: ArchiveOp = { kind: "trashDoc", id: "d1" };

	it("무엇을 했는지를 보내고 바뀐 보관함을 받는다", async () => {
		const index = emptyIndex();
		fetchMock.mockResolvedValue(응답({ index }));

		expect(await sendOp(op)).toEqual({ index });

		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe("/api/archive/ops");
		expect(init?.method).toBe("POST");
		expect(init?.headers).toEqual({ "Content-Type": "application/json" });
		// 색인 전체가 아니라 연산 하나만 간다 — 그래야 지운 것이 지웠다고 전해진다
		expect(JSON.parse(String(init?.body))).toEqual(op);
	});

	it("만드는 연산이면 서버가 정한 id가 함께 온다", async () => {
		fetchMock.mockResolvedValue(
			응답({ index: emptyIndex(), createdDocId: "새원고" }),
		);
		const 결과 = await sendOp({ kind: "createDoc", path: "/" });
		expect(결과.createdDocId).toBe("새원고");
	});

	it("거절당하면 던진다 — 부르는 쪽이 되돌릴 수 있어야 한다", async () => {
		fetchMock.mockResolvedValue(응답(null, 400));
		await expect(sendOp(op)).rejects.toThrow("400");
	});
});

describe("캐시 자리", () => {
	it("한 곳으로 고정되어 있다", () => {
		// 읽는 쪽과 고치는 쪽이 다른 키를 보면 낙관적 갱신이 화면에 닿지 않는다
		expect(ARCHIVE_KEY).toEqual(["archive"]);
	});
});
