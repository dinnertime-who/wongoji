import { isDay, shiftDay } from "#/shared/lib/day";

/**
 * 브라우저가 보낸 날짜를 받을지 정한다. **서버로 오는 유일한 관문이다.**
 *
 * 날짜를 브라우저가 정하는 이유는 시간대가 거기 있기 때문이지만
 * (`shared/lib/day.ts`), 그 말은 **요청 몸통에 적혀 온다**는 뜻이기도 하다. 손으로
 * 고칠 수 있는 값이라 모양만 보고 믿으면, 아무나 제 잔디를 한 해치 심을 수 있다.
 *
 * 그래서 서버의 오늘에서 **하루 안쪽**만 받는다. 실재하는 시간대는 UTC-12에서
 * UTC+14 사이라, 어느 곳에 있든 그 사람의 오늘은 서버의 UTC 오늘과 하루 넘게
 * 벌어지지 않는다.
 *
 * **아니면 null이다** — 그날은 기록하지 않는다. 저장 자체를 막지는 않는다.
 * 잔디 한 칸 때문에 원고를 잃게 할 수는 없다.
 */
export function parseWritingDay(
	value: unknown,
	utcToday: string,
): string | null {
	if (!isDay(value)) return null;
	return value >= shiftDay(utcToday, -1) && value <= shiftDay(utcToday, 1)
		? value
		: null;
}
