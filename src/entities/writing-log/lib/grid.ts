import { shiftDay, weekdayOf } from "#/shared/lib/day";
import { LEVELS } from "../config/levels";
import type { GrassCell, GrassWeek, WritingLog } from "../model/types";

/**
 * 기록을 잔디 격자로 옮긴다. **순수 함수다 — "오늘"을 인자로 받는다.**
 *
 * 오늘이 며칠인지를 안에서 묻지 않는 이유가 둘이다. 하나는 시험할 수 있어야
 * 해서고, 하나는 **이 앱에서 오늘은 브라우저만 아는 값**이기 때문이다. 서버는
 * UTC에 살아서 새벽에 쓴 글을 어제로 민다(`shared/lib/day.ts`).
 *
 * 세로 한 줄이 한 주고 일요일이 맨 위다. 마지막 줄이 이번 주라, 아직 오지 않은
 * 날은 빈자리(`null`)로 남는다 — 0으로 채우면 "그날 안 썼다"로 읽혀서, 토요일에
 * 보는 사람에게는 앞으로 사흘을 이미 놓친 것처럼 보인다.
 */
export function buildGrid(
	today: string,
	log: WritingLog,
	weeks: number,
): GrassWeek[] {
	const written = new Map(log.map((d) => [d.day, d.chars]));

	/*
	 * 마지막 줄의 일요일에서 거꾸로 센다. 오늘에서 그냥 `weeks * 7`을 빼면 첫
	 * 줄이 주 중간에서 시작해 격자가 요일마다 어긋난다.
	 */
	const lastSunday = shiftDay(today, -weekdayOf(today));
	const first = shiftDay(lastSunday, -(weeks - 1) * 7);

	const grid: GrassWeek[] = [];
	let day = first;

	for (let w = 0; w < weeks; w += 1) {
		const days: (GrassCell | null)[] = [];
		for (let i = 0; i < 7; i += 1) {
			// 아직 오지 않은 날. 마지막 줄에서만 생긴다
			days.push(day > today ? null : cellOf(day, written));
			day = shiftDay(day, 1);
		}
		grid.push({ days });
	}
	return grid;
}

function cellOf(day: string, written: Map<string, number>): GrassCell {
	const chars = written.get(day);
	return {
		day,
		chars: chars ?? 0,
		// **줄이 있으면 손댄 날이다.** 줄어들었어도(음수) 빈칸이 아니다
		level: chars === undefined ? 0 : levelOf(chars),
	};
}

/**
 * 그날의 진하기.
 *
 * 손댄 날은 바닥이 1이다. 0은 오직 "기록이 없는 날"에만 쓴다 — 둘을 같은 색으로
 * 칠하면 퇴고한 하루가 쉰 하루와 구별되지 않는다.
 */
export function levelOf(chars: number): 1 | 2 | 3 | 4 {
	if (chars >= LEVELS[2]) return 4;
	if (chars >= LEVELS[1]) return 3;
	if (chars >= LEVELS[0]) return 2;
	return 1;
}
