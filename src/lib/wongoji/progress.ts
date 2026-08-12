import { CELLS_PER_SHEET } from "./types";

/**
 * 분량 목표를 재는 값들.
 *
 * 목표는 매수로 적고 분량은 글자로 재므로 그 사이를 옮기는 계산이 필요하다.
 * 200자가 한 매라는 것이 이 앱의 규칙이니, 화면이 아니라 엔진이 알아야 한다.
 */

/** 목표 매수를 글자 수로 */
export const goalChars = (goal: number): number => goal * CELLS_PER_SHEET;

/** 목표까지 남은 글자 수. 음수면 그만큼 넘긴 것이다 */
export const remainingChars = (chars: number, goal: number): number =>
	goalChars(goal) - chars;

/** 목표 대비 진행. 0~1로 자른다 — 넘긴 것은 막대가 아니라 숫자로 알린다 */
export const goalRatio = (chars: number, goal: number): number =>
	goal > 0 ? Math.min(1, chars / goalChars(goal)) : 0;

/**
 * 목표 대비 진행을 적은 말 — `3 / 70매`.
 *
 * 목표가 없으면 null이다. 그때 무엇을 대신 보여줄지는 자리마다 다르다 —
 * 원고 위에서는 글자 수까지, 머리말에서는 매수만.
 */
export const goalProgress = (sheets: number, goal: number): string | null =>
	goal > 0 ? `${sheets} / ${goal}매` : null;
