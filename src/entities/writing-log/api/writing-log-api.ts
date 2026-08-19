import type { WritingLog } from "../model/types";

/**
 * 잔디를 받아 오는 길.
 *
 * 쓰는 길은 없다. 잔디는 원고를 저장할 때 저절로 심긴다 — 심는 길을 따로 두면
 * 원고 없이 잔디만 자랄 수 있게 된다.
 */

/** 질의 캐시에서 잔디가 놓이는 자리 */
export const WRITING_LOG_KEY = ["writing-log"] as const;

export interface WritingLogPayload {
	/**
	 * **서버가 정해서 보낸 오늘.**
	 *
	 * 브라우저에서 다시 세지 않는 이유는 첫 그림 때문이다. 서버가 그린 격자와
	 * 브라우저가 그린 격자의 마지막 칸이 다르면 하이드레이션에서 한 칸씩 밀린다.
	 * 시간대는 쿠키로 이미 서버에 가 있으므로(`shared/lib/timezone.ts`) 양쪽이
	 * 같은 답을 낼 수 있는데, 굳이 두 번 세어 어긋날 자리를 만들 이유가 없다.
	 */
	today: string;
	log: WritingLog;
}

export async function fetchWritingLog(): Promise<WritingLogPayload> {
	const response = await fetch("/api/writing-log");
	if (!response.ok) {
		throw new Error(`잔디 서버가 ${response.status}로 답했습니다`);
	}
	return (await response.json()) as WritingLogPayload;
}
