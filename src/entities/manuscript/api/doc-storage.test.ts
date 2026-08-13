import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { drainOutbox, readDoc, setDocOwner, writeDoc } from "./doc-storage";

/**
 * 본문이 서버로 가는 길과, 못 갔을 때 남는 자리.
 *
 * 여기가 이 구조에서 제일 위험한 자리다 — 저장 한 번이 실패했을 때 문단 하나가
 * 사라지는지 아닌지가 이 파일에 달려 있다.
 */

/** 서버 노릇. 원고 id마다 본문을 들고 있고, 넘어지라고 시킬 수 있다 */
function server() {
	const rows = new Map<string, unknown>();
	let down = false;

	const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
		const id = decodeURIComponent(String(input).split("/").pop() ?? "");
		if (down) throw new TypeError("네트워크가 끊겼다");

		if (init?.method === "PUT") {
			rows.set(id, JSON.parse(String(init.body)).content);
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		}
		if (!rows.has(id)) {
			return new Response(JSON.stringify({ error: "없다" }), { status: 404 });
		}
		return new Response(JSON.stringify({ content: rows.get(id) }), {
			status: 200,
		});
	});

	vi.stubGlobal("fetch", fetcher);
	return {
		rows,
		fetcher,
		down: (v: boolean) => {
			down = v;
		},
		break500: () => {
			fetcher.mockImplementation(
				async () => new Response("아이고", { status: 500 }),
			);
		},
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
	setDocOwner(null);
});

describe("본문 저장", () => {
	it("서버에 넣는 데 성공하면 대기열에 남기지 않는다", async () => {
		const net = server();
		setDocOwner("갑");

		expect(await writeDoc("d1", { text: "가" })).toEqual({ ok: true });

		// 서버가 없다고 답해도 null이다 — 대기열에 남아 있었다면 그것을 주었을 것이다
		net.rows.delete("d1");
		expect(await readDoc("d1")).toBeNull();
	});

	it("못 보내면 대기열에 남고, 읽기가 그것을 먼저 준다", async () => {
		const net = server();
		setDocOwner("갑");
		net.down(true);

		const result = await writeDoc("d2", { text: "잃으면 안 되는 것" });
		expect(result.ok).toBe(false);

		/*
		 * 이것이 이 구조의 약속이다. 저장이 실패한 채로 새로고침한 사람에게
		 * 서버의 옛 글을 보여 주면, 그 위에 다시 쓰면서 잃는다.
		 */
		net.down(false);
		expect(await readDoc("d2")).toEqual({ text: "잃으면 안 되는 것" });
	});

	it("연결이 돌아오면 다시 보낸다", async () => {
		const net = server();
		setDocOwner("갑");
		net.down(true);
		await writeDoc("d3", { text: "나중에 간다" });

		net.down(false);
		await drainOutbox();

		expect(net.rows.get("d3")).toEqual({ text: "나중에 간다" });
	});

	it("임자가 다르면 보내지도 주지도 않는다", async () => {
		const net = server();
		setDocOwner("갑");
		net.down(true);
		await writeDoc("d4", { text: "갑의 글" });

		// 계정을 바꿔 로그인했다. 남의 원고를 내 계정에 쓰면 안 된다
		setDocOwner("을");
		net.down(false);
		await drainOutbox();

		expect(net.rows.has("d4")).toBe(false);
		expect(await readDoc("d4")).toBeNull();
	});
});

describe("본문 읽기", () => {
	it("없는 것은 null이다", async () => {
		server();
		setDocOwner("갑");
		expect(await readDoc("없는것")).toBeNull();
	});

	it("못 읽은 것은 던진다 — 없는 것과 뭉뚱그리면 빈 원고로 덮는다", async () => {
		const net = server();
		setDocOwner("갑");
		net.break500();

		await expect(readDoc("d5")).rejects.toThrow();
	});
});
