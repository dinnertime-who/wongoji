import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { docOwner, held, hold, pending, release, setDocOwner } from "./outbox";

/**
 * 아직 서버에 넣지 못한 본문.
 *
 * **임자를 가리는 것이 여기서 제일 중요하다.** 한 브라우저를 여럿이 쓴다 —
 * 계정을 바꿔 로그인하면 앞사람의 미전송 본문이 남아 있을 수 있고, 그것을 그대로
 * 보내면 **남의 원고를 내 계정에 쓴다.**
 *
 * 임자를 테스트마다 다르게 둔다. 대기열은 한 벌뿐이라 그래야 서로를 보지 않는다.
 */

afterEach(() => setDocOwner(null));

describe("임자가 없을 때", () => {
	it("아무것도 넣지 않는다", async () => {
		setDocOwner(null);
		await hold("d1", { text: "본문" });
		expect(await pending("d1")).toBeUndefined();
	});

	it("아무것도 보이지 않는다", async () => {
		setDocOwner(null);
		expect(await held()).toEqual([]);
		expect(docOwner()).toBeNull();
	});
});

describe("넣고 꺼내고 지운다", () => {
	it("넣은 것을 그대로 돌려준다", async () => {
		setDocOwner("u-왕복");
		await hold("d1", { text: "못 보낸 본문" });
		expect(await pending("d1")).toEqual({ text: "못 보낸 본문" });
	});

	it("보내는 데 성공하면 지운다", async () => {
		setDocOwner("u-지우기");
		await hold("d1", { text: "본문" });
		await release("d1");
		expect(await pending("d1")).toBeUndefined();
	});

	it("넣은 적 없는 원고는 없다", async () => {
		setDocOwner("u-없음");
		expect(await pending("한번도없던것")).toBeUndefined();
	});

	it("나중 것이 앞엣것을 덮는다", async () => {
		setDocOwner("u-덮기");
		await hold("d1", { text: "처음" });
		await hold("d1", { text: "나중" });
		expect(await pending("d1")).toEqual({ text: "나중" });
	});
});

describe("임자를 가린다", () => {
	it("남이 넣어 둔 것은 없는 것으로 본다", async () => {
		/*
		 * **여기가 이 파일의 이유다.** 가리지 않으면 계정을 바꿔 로그인한 사람이
		 * 앞사람의 원고를 제 계정에 저장한다.
		 */
		setDocOwner("u-앞사람");
		await hold("공용원고", { text: "앞사람이 쓰던 글" });

		setDocOwner("u-뒷사람");
		expect(await pending("공용원고")).toBeUndefined();
	});

	it("훑을 때도 내 것만 나온다", async () => {
		setDocOwner("u-훑기-앞");
		await hold("남의것", { text: "앞사람" });

		setDocOwner("u-훑기-뒤");
		await hold("내것", { text: "뒷사람" });

		// 넣던 시각도 함께 나온다 — 못 보낸 글은 보낸 날이 아니라 쓴 날에 심긴다
		expect(await held()).toEqual([
			{ docId: "내것", content: { text: "뒷사람" }, at: expect.any(Number) },
		]);
	});

	it("계정을 되돌리면 제 것은 그대로 있다", async () => {
		setDocOwner("u-돌아옴");
		await hold("d1", { text: "내 글" });

		setDocOwner("u-다른사람");
		expect(await pending("d1")).toBeUndefined();

		setDocOwner("u-돌아옴");
		expect(await pending("d1")).toEqual({ text: "내 글" });
	});

	it("지우는 것은 임자를 묻지 않는다 — 보낸 뒤라 지울 것만 남는다", async () => {
		setDocOwner("u-지움");
		await hold("d1", { text: "본문" });
		await release("d1");
		expect(await held()).toEqual([]);
	});
});

describe("지금 임자", () => {
	it("마지막으로 알린 사람이다", () => {
		setDocOwner("u-지금");
		expect(docOwner()).toBe("u-지금");
		setDocOwner(null);
		expect(docOwner()).toBeNull();
	});
});
