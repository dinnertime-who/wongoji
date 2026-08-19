/**
 * 하루치 집필 기록 한 줄.
 *
 * 원고별로 나누지 않는다. 잔디가 묻는 것은 "그날 썼나"지 "어느 원고를 썼나"가
 * 아니고, 나누면 행이 원고 수만큼 늘면서 답할 수 있는 것은 그대로다.
 */
export interface WritingDay {
	/** `"2026-08-19"` — **글을 쓴 사람의 날짜다.** 서버의 UTC가 아니다 */
	day: string;
	/**
	 * 그날 늘어난 글자 수. **음수일 수 있다.**
	 *
	 * 퇴고는 글자를 줄이는 일이다. 줄어든 날을 빈칸으로 두면 문장을 하루 종일
	 * 깎은 사람이 아무것도 안 한 것이 되므로, **줄인 날도 잔디는 심긴다** —
	 * 줄 자체가 있다는 것이 손댔다는 뜻이다(`level`).
	 */
	chars: number;
}

/** 날짜순으로 올라간다. 손대지 않은 날은 아예 없다 */
export type WritingLog = WritingDay[];

/** 격자의 칸 하나. `null`은 격자를 채우려고 둔 자리다 — 아직 오지 않은 날 */
export interface GrassCell {
	day: string;
	chars: number;
	/** 0이면 손대지 않은 날. 1~4가 진하기다 */
	level: 0 | 1 | 2 | 3 | 4;
}

/** 세로 한 줄 = 한 주. 일요일이 맨 위다 */
export interface GrassWeek {
	/** 언제나 일곱 칸. 아직 오지 않은 날과 격자 앞을 채우는 자리는 null */
	days: (GrassCell | null)[];
}
