import { readCookie, readCookieHere, writeCookie } from "./cookie";

/**
 * 이 사람이 사는 시간대. **쿠키에 둔다.**
 *
 * 서버가 첫 HTML을 그릴 때 알아야 하는 것만 쿠키로 온다는 규칙([cookie.ts])
 * 그대로다. 잔디 격자가 그런 것 하나다 — 지난 한 해를 그리려면 **오늘이 며칠인지**
 * 부터 정해야 하는데, 서버는 UTC에 살아서 한국 시각 아침 아홉 시 전에는 어제를
 * 오늘이라 부른다. 격자의 끝 칸이 하루 어긋나 그려졌다가 하이드레이션에서 밀려
 * 나면 열 때마다 한 번씩 덜컥거린다 — 보관함 폭이 그랬던 것과 같다.
 *
 * **오프셋(분)이 아니라 이름(`Asia/Seoul`)을 적는다.** 오프셋은 그 순간의 값이라
 * 서머타임이 있는 곳에서는 반년 뒤에 틀린다. 이름이면 `Intl`이 그때그때 계산한다.
 *
 * [cookie.ts]: ./cookie.ts
 */

export const TZ_COOKIE = "wongoji_tz";

/**
 * 쓸 만한 이름인가.
 *
 * `Intl`에 그대로 넘길 값이라 거른다. 쿠키는 사람이 손으로 고칠 수 있는 자리고,
 * 거기서 온 문자열을 그대로 믿으면 서버가 던진다. 길이와 글자만 본다 — 실제로
 * 있는 시간대인지는 `dayIn`이 써 보고 안다.
 */
const looksLikeZone = (value: string): boolean =>
	value.length <= 64 && /^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(value);

const clean = (value: string | null): string | null =>
	value && looksLikeZone(value) ? value : null;

/** 쿠키 헤더에서 읽는다. **서버가 부르는 자리다** */
export const readTimeZone = (
	header: string | null | undefined,
): string | null => clean(readCookie(header, TZ_COOKIE));

/** 브라우저에 적힌 것 */
export const readTimeZoneHere = (): string | null =>
	clean(readCookieHere(TZ_COOKIE));

/** 이 브라우저가 실제로 있는 곳. 못 물으면 null */
export function timeZoneHere(): string | null {
	try {
		return clean(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
	} catch {
		return null;
	}
}

/**
 * 적어 둔다. **달라졌을 때만 적는다.**
 *
 * 비행기를 타고 내리면 바뀐다. 매번 적어도 해로울 것은 없지만, 쿠키 쓰기는
 * 렌더마다 지나는 자리라 값이 같으면 건드리지 않는 편이 읽기 쉽다.
 */
export function syncTimeZone(): void {
	const here = timeZoneHere();
	if (!here || here === readTimeZoneHere()) return;
	writeCookie(TZ_COOKIE, here);
}
