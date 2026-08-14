import { describe, expect, it } from "vitest";
import {
	DEFAULT_STATUS,
	DOC_STATUSES,
	isDocStatus,
	isPromotion,
	STATUS_LABEL,
	statusOf,
} from "./status";

/**
 * 원고의 진행 상태.
 *
 * **`isPromotion`이 버전을 남길지 가른다.** 참이면 그때의 본문이 서버에 박제되고,
 * 거짓이면 남지 않는다. 느슨해지면 원고 수 × 저장 횟수만큼 버전이 쌓이고,
 * 빡빡해지면 되돌릴 자리가 사라진다.
 */

describe("적히지 않은 상태", () => {
	it("빈 값은 초고로 읽는다", () => {
		// 상태가 생기기 전에 쓴 원고들이 그렇다. 마이그레이션 대신 읽는 규칙으로 맞춘다
		expect(statusOf(null)).toBe("draft");
		expect(statusOf(undefined)).toBe("draft");
		expect(DEFAULT_STATUS).toBe("draft");
	});

	it("적힌 것은 그대로 읽는다", () => {
		expect(statusOf("revising")).toBe("revising");
		expect(statusOf("done")).toBe("done");
	});
});

describe("올리는 전이인가", () => {
	it("등급이 오르면 참이다", () => {
		expect(isPromotion("draft", "revising")).toBe(true);
		expect(isPromotion("draft", "done")).toBe(true);
		expect(isPromotion("revising", "done")).toBe(true);
	});

	it("내리는 것은 아니다 — 남길 본문이 이미 직전 버전으로 있다", () => {
		expect(isPromotion("done", "revising")).toBe(false);
		expect(isPromotion("done", "draft")).toBe(false);
		expect(isPromotion("revising", "draft")).toBe(false);
	});

	it("제자리는 아니다", () => {
		for (const status of DOC_STATUSES) {
			expect(isPromotion(status, status)).toBe(false);
		}
	});

	it("빈 값에 초고를 적는 것은 전이가 아니다", () => {
		/*
		 * **새로 만든 원고마다 빈 본문이 버전으로 박제되던 것이 여기서 막힌다.**
		 * 양쪽 다 초고로 읽히므로 오르는 것이 없다.
		 */
		expect(isPromotion(null, "draft")).toBe(false);
		expect(isPromotion(undefined, "draft")).toBe(false);
	});

	it("빈 값에서 위로 가는 것은 전이다", () => {
		expect(isPromotion(null, "revising")).toBe(true);
		expect(isPromotion(undefined, "done")).toBe(true);
	});
});

describe("바깥에서 온 값", () => {
	it("셋 중 하나인지 가린다", () => {
		// 서버로 오는 patch가 이것을 지난다. 아무 글자나 상태 칸에 들어가면 안 된다
		for (const status of DOC_STATUSES) expect(isDocStatus(status)).toBe(true);
		expect(isDocStatus("제출")).toBe(false);
		expect(isDocStatus("")).toBe(false);
		expect(isDocStatus(null)).toBe(false);
		expect(isDocStatus(undefined)).toBe(false);
		expect(isDocStatus(1)).toBe(false);
		expect(isDocStatus({ kind: "done" })).toBe(false);
	});
});

describe("이름", () => {
	it("셋 다 두 글자다 — 좁은 줄에 들어가야 한다", () => {
		for (const status of DOC_STATUSES) {
			expect(STATUS_LABEL[status]).toHaveLength(2);
		}
	});
});
