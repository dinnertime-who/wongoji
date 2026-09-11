import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import {
	feedbackEmailContent,
	validateFeedbackInput,
} from "#/features/send-feedback";

const FEEDBACK_FROM = {
	email: "feedback@dinnertimes.app",
	name: "Wongo Feedback",
} as const;

// `wrangler.jsonc`의 destination_address와 같은 주소로 고정한다.
const FEEDBACK_RECIPIENT = "dinnertime.dev@gmail.com";

/** 받는 사람과 보내는 사람은 서버가 고정하고, 클라이언트에는 선택권을 주지 않는다. */
export const sendFeedback = createServerFn({ method: "POST" })
	.validator(validateFeedbackInput)
	.handler(async ({ data }) => {
		await env.FEEDBACK_EMAIL.send({
			to: FEEDBACK_RECIPIENT,
			from: FEEDBACK_FROM,
			...feedbackEmailContent(data, new Date().toISOString()),
		});

		return { success: true } as const;
	});
