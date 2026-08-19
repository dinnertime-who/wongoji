/**
 * 날짜 한 칸 — `"2026-08-19"`.
 *
 * **글을 쓴 사람의 날짜다.** 잔디는 "어제 썼나 오늘 썼나"를 묻는 것이라, 서버가
 * 사는 UTC로 자르면 한국에서 **오전 아홉 시 전에 쓴 글이 전부 전날 칸에 심긴다.**
 * 새벽에 쓰는 사람에게는 거의 매일 어긋나는 셈이고, 그런 사람이 원고 앱을 쓴다.
 *
 * 그래서 날짜를 **문자열로** 주고받는다. 시각(밀리초)으로 주고받으면 받는 쪽이
 * 다시 어느 시간대로 자를지 정해야 하는데, 그것을 아는 것은 브라우저뿐이다.
 * 잘라 놓은 것을 보내면 서버는 시간대를 몰라도 되고 — 아는 척할 자리도 없다.
 *
 * 여기 있는 것은 전부 순수 함수다. `Date.now()`를 부르는 것도 없다 — 지금이
 * 언제인지는 부르는 쪽이 안다.
 */

/** `2026-08-19` 모양인가. 사람이 손댈 수 있는 값이라(요청 몸통) 반드시 거른다 */
export const isDay = (value: unknown): value is string =>
	typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 이 시각이 **이 브라우저에서** 며칠인가.
 *
 * `getFullYear`·`getMonth`·`getDate`는 로컬 시간대로 답한다. `toISOString()`을
 * 쓰지 않는 이유가 그것이다 — 그쪽은 UTC라 정확히 우리가 피하려는 값을 준다.
 */
export function localDay(at: number | Date): string {
	const d = at instanceof Date ? at : new Date(at);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 이 시각이 **저 시간대에서** 며칠인가. 서버가 "오늘"을 알아야 할 때 쓴다.
 *
 * `en-CA`를 고른 이유는 그 로케일의 짧은 날짜가 `2026-08-19`라서다. 자리를
 * 손으로 맞추는 것보다 짧고, 무엇보다 시간대 변환을 `Intl`이 한다 — 서머타임이
 * 있는 곳까지 우리가 계산할 이유가 없다.
 *
 * 시간대 이름이 엉뚱하면 `Intl`이 던진다. 그때는 UTC로 떨어진다 — 쿠키는 사람이
 * 고칠 수 있는 자리다.
 */
export function dayIn(at: number | Date, timeZone: string | null): string {
	const d = at instanceof Date ? at : new Date(at);
	if (!timeZone) return utcDay(d);
	try {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(d);
	} catch {
		return utcDay(d);
	}
}

/** 시간대를 모를 때 떨어지는 곳 */
export const utcDay = (at: number | Date): string =>
	(at instanceof Date ? at : new Date(at)).toISOString().slice(0, 10);

/**
 * 며칠 뒤(앞)의 날짜.
 *
 * **UTC 정오에서 센다.** 자정에서 세면 서머타임이 있는 곳에서 하루가 23시간이나
 * 25시간이 되어 날짜가 하나 건너뛰거나 겹친다. 정오는 그 ±1시간을 다 흡수한다.
 */
export function shiftDay(day: string, by: number): string {
	const [y, m, d] = day.split("-").map(Number);
	const at = Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12);
	return utcDay(at + by * 24 * 60 * 60 * 1000);
}

/** `from`부터 `to`까지 며칠인가. 같은 날이면 0 */
export function daysBetween(from: string, to: string): number {
	const at = (day: string) => {
		const [y, m, d] = day.split("-").map(Number);
		return Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12);
	};
	return Math.round((at(to) - at(from)) / (24 * 60 * 60 * 1000));
}

/** 이 날짜의 요일. 0이 일요일 — 잔디 격자의 세로 자리다 */
export function weekdayOf(day: string): number {
	const [y, m, d] = day.split("-").map(Number);
	return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12)).getUTCDay();
}
