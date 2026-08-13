import { ROWS } from "./types";

/**
 * 분량 목표를 재는 값들.
 *
 * **목표도 분량도 매로 잰다.** 전에는 목표를 매로 적고 분량은 글자로 재서, 그
 * 사이를 200으로 나누고 곱하는 계산이 있었다. 그런데 이 앱이 내야 하는 매수는
 * 글자수 기준이 아니라 **조판 기준**이라(`docs/contest-features.md`) 그 환산이
 * 애초에 성립하지 않는다 — 문단이 잦은 원고일수록 어긋난다.
 *
 * 그래서 남은 분량도 줄로 센다. 한 매가 10줄이라 나누어떨어지고, 원고지 위에서
 * 줄은 눈에 보이는 단위다.
 */

/** 목표 매수를 줄 수로. 한 매가 {@link ROWS}줄이다 */
export const goalLines = (goal: number): number => goal * ROWS;

/** 목표까지 남은 줄. 음수면 그만큼 넘긴 것이다 */
export const remainingLines = (lines: number, goal: number): number =>
	goalLines(goal) - lines;

/** 목표 대비 진행. 0~1로 자른다 — 넘긴 것은 막대가 아니라 숫자로 알린다 */
export const goalRatio = (lines: number, goal: number): number =>
	goal > 0 ? Math.min(1, lines / goalLines(goal)) : 0;

/**
 * 목표 대비 진행을 적은 말 — `3 / 70매`.
 *
 * 목표가 없으면 null이다. 그때 무엇을 대신 보여줄지는 자리마다 다르다 —
 * 원고 위에서는 글자 수까지, 머리말에서는 매수만.
 */
export const goalProgress = (sheets: number, goal: number): string | null =>
	goal > 0 ? `${sheets} / ${goal}매` : null;
