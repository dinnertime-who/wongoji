import { describe, expect, it } from "vitest";
import { enqueue, type Queued } from "./save-queue";

/**
 * 밀린 저장을 합치는 규칙.
 *
 * 짧지만 여기가 어긋나면 **앞 원고의 글자가 지금 원고에 쏟아진다.** 사이드바에서
 * 원고를 빠르게 오갈 때 실제로 나던 일이다.
 */

interface Patch {
	title?: string;
	goal?: number;
	content?: string;
}

describe("같은 원고", () => {
	it("늦게 온 값이 이긴다", () => {
		const 처음 = enqueue<Patch>(null, "a", { title: "첫 제목" });
		const 나중 = enqueue(처음, "a", { title: "고친 제목" });
		expect(나중.patch).toEqual({ title: "고친 제목" });
	});

	it("서로 다른 칸은 함께 남는다", () => {
		// 제목을 고치다 본문을 고쳤으면 둘 다 나가야 한다
		let 큐: Queued<Patch> | null = null;
		큐 = enqueue(큐, "a", { title: "제목" });
		큐 = enqueue(큐, "a", { content: "본문" });
		큐 = enqueue(큐, "a", { goal: 70 });
		expect(큐.patch).toEqual({ title: "제목", content: "본문", goal: 70 });
	});

	it("한 칸만 덮고 나머지는 그대로 둔다", () => {
		const 큐 = enqueue(
			enqueue<Patch>(null, "a", { title: "제목", goal: 70 }),
			"a",
			{ goal: 80 },
		);
		expect(큐.patch).toEqual({ title: "제목", goal: 80 });
	});
});

describe("다른 원고", () => {
	it("합치지 않고 갈아탄다", () => {
		/*
		 * **여기가 이 파일의 이유다.** 합쳐 버리면 a에 쓰려던 제목이 b의 저장에
		 * 실려 나간다 — 손대지도 않은 원고의 제목이 바뀐다.
		 */
		const 앞 = enqueue<Patch>(null, "a", { title: "감나무 있는 마당" });
		const 뒤 = enqueue(앞, "b", { content: "다른 원고" });
		expect(뒤).toEqual({ docId: "b", patch: { content: "다른 원고" } });
	});

	it("임자를 늘 함께 든다 — 밀어 넣는 쪽이 헷갈릴 수 없다", () => {
		const 큐 = enqueue<Patch>(null, "a", { title: "제목" });
		expect(큐.docId).toBe("a");
	});
});

describe("임자가 없는 원고 — 체험 원고", () => {
	it("빈 id끼리는 늘 합쳐진다", () => {
		// 로그인 없이 쓰는 원고는 한 편뿐이라 가릴 임자가 없다
		const 큐 = enqueue(enqueue<Patch>(null, "", { title: "제목" }), "", {
			content: "본문",
		});
		expect(큐.patch).toEqual({ title: "제목", content: "본문" });
	});
});

describe("순수하다", () => {
	it("들고 있던 것을 고치지 않는다", () => {
		const 앞 = enqueue<Patch>(null, "a", { title: "제목" });
		enqueue(앞, "a", { title: "고친 제목" });
		expect(앞.patch).toEqual({ title: "제목" });
	});
});
