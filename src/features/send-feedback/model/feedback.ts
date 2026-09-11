export const FEEDBACK_TYPES = ["bug", "suggestion", "other"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export interface FeedbackInput {
	type: FeedbackType;
	message: string;
	email?: string;
	path: string;
}

export interface FeedbackEmailContent {
	replyTo?: string;
	subject: string;
	text: string;
}

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
	bug: "버그",
	suggestion: "개선 제안",
	other: "기타",
};

export const FEEDBACK_MESSAGE_MAX = 3000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isFeedbackType(value: unknown): value is FeedbackType {
	return FEEDBACK_TYPES.some((type) => type === value);
}

export function isValidEmail(value: string): boolean {
	return value.length <= 254 && EMAIL_PATTERN.test(value);
}

/**
 * 서버 함수가 받는 값을 정규화하고 검증한다.
 *
 * 브라우저의 폼을 거치지 않고 서버 함수 주소를 직접 부를 수 있으므로 `unknown`에서
 * 시작한다. 받는 사람과 보내는 사람은 이 입력에 아예 없다.
 */
export function validateFeedbackInput(input: unknown): FeedbackInput {
	if (typeof input !== "object" || input === null) {
		throw new Error("올바르지 않은 의견입니다.");
	}

	const value = input as Record<string, unknown>;
	if (!isFeedbackType(value.type)) {
		throw new Error("올바른 의견 유형을 선택해주세요.");
	}
	if (typeof value.message !== "string" || !value.message.trim()) {
		throw new Error("의견을 입력해주세요.");
	}
	if (value.message.length > FEEDBACK_MESSAGE_MAX) {
		throw new Error(`의견은 ${FEEDBACK_MESSAGE_MAX}자까지 입력할 수 있습니다.`);
	}
	if (typeof value.path !== "string") {
		throw new Error("올바르지 않은 페이지 경로입니다.");
	}

	if (value.email !== undefined && typeof value.email !== "string") {
		throw new Error("올바른 이메일 주소를 입력해주세요.");
	}
	const email = typeof value.email === "string" ? value.email.trim() : "";
	if (email && !isValidEmail(email)) {
		throw new Error("올바른 이메일 주소를 입력해주세요.");
	}

	return {
		type: value.type,
		message: value.message.trim(),
		email: email || undefined,
		path: value.path,
	};
}

/** 서버가 만든 접수 시각과 검증된 입력으로 plain text 메일 내용을 조립한다. */
export function feedbackEmailContent(
	data: FeedbackInput,
	receivedAt: string,
): FeedbackEmailContent {
	return {
		replyTo: data.email,
		subject: `[Wongo 의견] ${FEEDBACK_TYPE_LABEL[data.type]}`,
		text: [
			"Wongo에 새로운 의견이 도착했습니다.",
			"",
			`유형: ${FEEDBACK_TYPE_LABEL[data.type]}`,
			`사용자 이메일: ${data.email ?? "미입력"}`,
			`페이지: ${data.path}`,
			`접수 시각: ${receivedAt}`,
			"",
			"----------------------------------------",
			"",
			data.message,
		].join("\n"),
	};
}
