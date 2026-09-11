import { describe, expect, it } from "vitest";
import {
	FEEDBACK_MESSAGE_MAX,
	feedbackEmailContent,
	validateFeedbackInput,
} from "./feedback";

const valid = {
	type: "suggestion",
	message: "모바일에서도 PDF로 저장하고 싶습니다.",
	path: "/write",
} as const;

describe("validateFeedbackInput", () => {
	it.each(["bug", "suggestion", "other"])("%s 유형을 받는다", (type) => {
		expect(validateFeedbackInput({ ...valid, type })).toMatchObject({ type });
	});

	it("선택 이메일을 다듬어 남긴다", () => {
		expect(
			validateFeedbackInput({ ...valid, email: " user@example.com " }),
		).toEqual({ ...valid, email: "user@example.com" });
	});

	it("이메일을 입력하지 않으면 생략한다", () => {
		expect(validateFeedbackInput({ ...valid, email: "  " })).toEqual(valid);
	});

	it.each([
		["빈 의견", { ...valid, message: "" }],
		["공백 의견", { ...valid, message: " \n\t " }],
		[
			"3000자 초과 의견",
			{ ...valid, message: "가".repeat(FEEDBACK_MESSAGE_MAX + 1) },
		],
		["잘못된 유형", { ...valid, type: "question" }],
		["잘못된 이메일", { ...valid, email: "not-an-email" }],
		["문자열이 아닌 경로", { ...valid, path: 1 }],
	])("%s을 거부한다", (_name, input) => {
		expect(() => validateFeedbackInput(input)).toThrow();
	});
});

describe("feedbackEmailContent", () => {
	it.each([
		["bug", "버그"],
		["suggestion", "개선 제안"],
		["other", "기타"],
	] as const)("%s 유형을 제목과 본문에 표시한다", (type, label) => {
		const email = feedbackEmailContent(
			{ ...valid, type },
			"2026-09-11T07:30:00.000Z",
		);

		expect(email.subject).toBe(`[Wongo 의견] ${label}`);
		expect(email.text).toContain(`유형: ${label}`);
	});

	it("사용자 이메일을 Reply-To와 본문에 넣는다", () => {
		const email = feedbackEmailContent(
			{ ...valid, email: "user@example.com" },
			"2026-09-11T07:30:00.000Z",
		);

		expect(email.replyTo).toBe("user@example.com");
		expect(email.text).toContain("사용자 이메일: user@example.com");
	});

	it("이메일이 없으면 미입력으로 적고 페이지와 접수 시각을 남긴다", () => {
		const email = feedbackEmailContent(valid, "2026-09-11T07:30:00.000Z");

		expect(email.replyTo).toBeUndefined();
		expect(email.text).toContain("사용자 이메일: 미입력");
		expect(email.text).toContain("페이지: /write");
		expect(email.text).toContain("접수 시각: 2026-09-11T07:30:00.000Z");
		expect(email.text).toContain(valid.message);
	});
});
