import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liftAccountBodies } from "./lift-bodies";

/**
 * 계정 칸에만 있는 본문을 서버로 올린다.
 *
 * **404일 때만 올린다.** 서버가 정본이 되기 전에 뒤에서 밀어 넣던 것이 다 가지
 * 못해 색인은 서버에 있는데 본문이 404인 원고가 실제로 있었다. 그것을 채우는
 * 일인데, 조건을 느슨하게 잡으면 **다른 기기에서 이어 쓴 새 본문 위에 이
 * 브라우저의 옛 사본을 덮는다** — 고치려던 것보다 나쁜 결과가 된다.
 */

const legacy = vi.hoisted(() => ({ bodies: vi.fn() }));
const manuscript = vi.hoisted(() => ({ writeDoc: vi.fn() }));

vi.mock("../api/legacy-store", () => ({
	listAccountBodies: legacy.bodies,
}));
vi.mock("#/entities/manuscript", () => ({
	writeDoc: manuscript.writeDoc,
}));

const 응답 = (status: number): Response =>
	({ ok: status >= 200 && status < 300, status }) as Response;

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

const fetchMock = vi.fn<typeof fetch>();
let storage: Storage;

/** 이 계정을 다 훑었다고 적혔는가 */
const 마쳤다 = (userId: string) =>
	storage.getItem(`wongoji:v1:lifted:${userId}`) === "1";

beforeEach(() => {
	legacy.bodies.mockReset().mockResolvedValue([]);
	manuscript.writeDoc.mockReset().mockResolvedValue({ ok: true });
	fetchMock.mockReset();
	storage = fakeStorage();
	vi.stubGlobal("fetch", fetchMock);
	vi.stubGlobal("window", { localStorage: storage });
});

afterEach(() => vi.unstubAllGlobals());

describe("올릴지 가리기", () => {
	it("서버에 없으면(404) 올린다", async () => {
		legacy.bodies.mockResolvedValue([{ id: "d1", content: { text: "본문" } }]);
		fetchMock.mockResolvedValue(응답(404));

		expect(await liftAccountBodies("u1")).toBe(1);
		expect(manuscript.writeDoc).toHaveBeenCalledWith("d1", { text: "본문" });
	});

	it("서버에 있으면 손대지 않는다", async () => {
		/*
		 * **여기가 이 파일의 이유다.** 덮으면 다른 기기에서 이어 쓴 원고를 잃는다.
		 */
		legacy.bodies.mockResolvedValue([
			{ id: "d1", content: { text: "옛 사본" } },
		]);
		fetchMock.mockResolvedValue(응답(200));

		expect(await liftAccountBodies("u1")).toBe(0);
		expect(manuscript.writeDoc).not.toHaveBeenCalled();
	});

	it("서버가 다른 답을 하면 건너뛴다 — 다음 기회에", async () => {
		legacy.bodies.mockResolvedValue([{ id: "d1", content: { text: "본문" } }]);
		fetchMock.mockResolvedValue(응답(500));

		expect(await liftAccountBodies("u1")).toBe(0);
		expect(manuscript.writeDoc).not.toHaveBeenCalled();
	});

	it("본문이 비었으면 올리지 않는다 — 올리면 잃은 것을 덮는다", async () => {
		legacy.bodies.mockResolvedValue([{ id: "d1", content: null }]);

		expect(await liftAccountBodies("u1")).toBe(0);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(manuscript.writeDoc).not.toHaveBeenCalled();
	});

	it("올리지 못한 것은 세지 않는다", async () => {
		legacy.bodies.mockResolvedValue([
			{ id: "d1", content: { text: "하나" } },
			{ id: "d2", content: { text: "둘" } },
		]);
		fetchMock.mockResolvedValue(응답(404));
		manuscript.writeDoc
			.mockResolvedValueOnce({ ok: true })
			.mockResolvedValueOnce({ ok: false, kind: "offline", message: "" });

		expect(await liftAccountBodies("u1")).toBe(1);
	});
});

describe("연결이 끊겼을 때", () => {
	it("물어보지 못하면 거기서 멈추고 다 마쳤다고 적지 않는다", async () => {
		/*
		 * 적어 두면 다시는 훑지 않는다. 못 물어봤을 뿐인데 표시하면 아직 서버에
		 * 없는 본문이 영영 올라가지 않는다.
		 */
		legacy.bodies.mockResolvedValue([
			{ id: "d1", content: { text: "하나" } },
			{ id: "d2", content: { text: "둘" } },
		]);
		fetchMock.mockRejectedValue(new Error("끊겼다"));

		expect(await liftAccountBodies("u1")).toBe(0);
		expect(마쳤다("u1")).toBe(false);
	});

	it("앞엣것까지 올린 뒤 끊기면 그만큼은 센다", async () => {
		legacy.bodies.mockResolvedValue([
			{ id: "d1", content: { text: "하나" } },
			{ id: "d2", content: { text: "둘" } },
		]);
		fetchMock
			.mockResolvedValueOnce(응답(404))
			.mockRejectedValueOnce(new Error("끊겼다"));

		expect(await liftAccountBodies("u1")).toBe(1);
		expect(마쳤다("u1")).toBe(false);
	});
});

describe("마친 계정은 다시 훑지 않는다", () => {
	it("한 바퀴를 끝까지 돌면 적어 둔다", async () => {
		legacy.bodies.mockResolvedValue([{ id: "d1", content: { text: "본문" } }]);
		fetchMock.mockResolvedValue(응답(404));

		await liftAccountBodies("u1");
		expect(마쳤다("u1")).toBe(true);
	});

	it("올릴 것이 없어도 적어 둔다", async () => {
		legacy.bodies.mockResolvedValue([]);

		expect(await liftAccountBodies("u1")).toBe(0);
		expect(마쳤다("u1")).toBe(true);
	});

	it("적힌 계정은 저장소를 열어 보지도 않는다", async () => {
		/*
		 * 원고마다 서버에 한 번씩 물어보는 일이다. 표시하지 않으면 앱을 열 때마다
		 * 원고 수만큼 요청이 나간다.
		 */
		storage.setItem("wongoji:v1:lifted:u1", "1");

		expect(await liftAccountBodies("u1")).toBe(0);
		expect(legacy.bodies).not.toHaveBeenCalled();
	});

	it("계정마다 따로 적는다", async () => {
		storage.setItem("wongoji:v1:lifted:u1", "1");
		legacy.bodies.mockResolvedValue([]);

		await liftAccountBodies("u2");
		expect(legacy.bodies).toHaveBeenCalledWith("u2");
	});
});
