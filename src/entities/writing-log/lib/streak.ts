import { daysBetween, shiftDay } from "#/shared/lib/day";
import type { WritingLog } from "../model/types";

/**
 * 잔디에서 뽑아내는 숫자들. **격자가 말하지 못하는 것만 센다.**
 *
 * 전부 순수 함수고 "오늘"을 인자로 받는다 — 이유는 `grid.ts`와 같다.
 */
export interface Tally {
	/** 지금 며칠째 이어 오고 있는가 */
	streak: number;
	/** 여태 가장 길었던 연속 */
	best: number;
	/** 이번 달 순증. **음수일 수 있다** — 덜어낸 달이다 */
	thisMonth: number;
	/** 기록이 있는 날의 수 */
	days: number;
}

const 손댄날 = (log: WritingLog): Set<string> => new Set(log.map((d) => d.day));

/**
 * 지금 며칠째인가.
 *
 * **오늘 아직 안 썼어도 끊지 않는다.** 어제까지 이어 왔으면 그것이 지금의
 * 연속이다 — 아침에 열었다는 이유로 "0일째"라고 말하면, 어제까지 서른 날을
 * 이어 온 사람에게 오늘 하루가 통째로 없어진 것처럼 보인다. 진짜로 끊기는 것은
 * 어제도 그제도 비었을 때다.
 */
export function streakOn(today: string, log: WritingLog): number {
	const wrote = 손댄날(log);
	// 오늘 썼으면 오늘부터, 아니면 어제부터 거꾸로 센다
	let day = wrote.has(today) ? today : shiftDay(today, -1);

	let n = 0;
	while (wrote.has(day)) {
		n += 1;
		day = shiftDay(day, -1);
	}
	return n;
}

/** 여태 가장 길었던 연속. 날짜순으로 훑으며 끊긴 자리를 센다 */
export function bestStreak(log: WritingLog): number {
	const days = [...손댄날(log)].sort();

	let best = 0;
	let run = 0;
	let prev: string | null = null;

	for (const day of days) {
		run = prev !== null && daysBetween(prev, day) === 1 ? run + 1 : 1;
		if (run > best) best = run;
		prev = day;
	}
	return best;
}

/** 이 달(`"2026-08"`)에 늘어난 분량 */
export const monthTotal = (month: string, log: WritingLog): number =>
	log
		.filter((d) => d.day.startsWith(`${month}-`))
		.reduce((sum, d) => sum + d.chars, 0);

export function tally(today: string, log: WritingLog): Tally {
	return {
		streak: streakOn(today, log),
		best: bestStreak(log),
		thisMonth: monthTotal(today.slice(0, 7), log),
		days: 손댄날(log).size,
	};
}
