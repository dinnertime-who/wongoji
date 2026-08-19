import { useQuery } from "@tanstack/react-query";
import { useUserId } from "#/shared/api/session";
import {
	fetchWritingLog,
	WRITING_LOG_KEY,
	type WritingLogPayload,
} from "../api/writing-log-api";

/**
 * 지난 한 해의 잔디.
 *
 * **로그인한 사람만 있다.** 잔디는 날마다 쌓이는 것이라 서버에 계정이 있어야
 * 하고, 체험 원고 한 편에는 쌓일 곳이 없다 — 비로그인에서는 물어봐야 401이다.
 *
 * `today`를 서버에서 받는 이유는 `writing-log-api.ts`에 적어 두었다.
 */
export function useWritingLog(): {
	data: WritingLogPayload | undefined;
	isPending: boolean;
} {
	const userId = useUserId();

	const { data, isPending } = useQuery({
		queryKey: WRITING_LOG_KEY,
		queryFn: fetchWritingLog,
		enabled: Boolean(userId),
	});

	// 질의를 끄면 react-query는 `isPending`을 계속 참으로 둔다 — `useArchive`와 같다
	return { data, isPending: Boolean(userId) && isPending };
}
