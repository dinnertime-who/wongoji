import { readCookie, readCookieHere, writeCookie } from "#/shared/lib/cookie";

/**
 * 마지막으로 연 원고.
 *
 * **이것만은 계정이 아니라 이 브라우저의 것이다.** 어느 원고를 보고 있었는지는
 * 기기마다 다르고, 다른 기기에서 열어 둔 원고가 여기서 열릴 이유가 없다.
 *
 * 계정별로 가르지 않는다. 계정을 바꾸면 이 id가 새 보관함에 없을 뿐이고, 그때는
 * 가장 최근에 고친 원고로 간다 — 스스로 바로잡히므로 칸을 나눌 값이 없다.
 *
 * ---
 *
 * **localStorage에서 쿠키로 옮겼다.** `/`에 들어온 사람을 어느 원고로 보낼지
 * 정하는 것이 이 값인데, localStorage에 있는 동안에는 서버가 그것을 알 수 없어
 * 판단이 브라우저까지 미뤄졌다 — 빈 화면을 띄워 놓고 JS를 다 받은 다음에야
 * 어디로 갈지 정했다. 쿠키면 서버가 첫 요청에서 바로 보낸다.
 *
 * 못 적어도 알리지 않는다. 다음에 열 때 다른 원고가 열린다는 뜻일 뿐이다.
 */
const KEY = "wongoji_last";

/** 쿠키 헤더에서. **서버가 부르는 자리다** */
export const readLastOpenedFrom = (
	header: string | null | undefined,
): string | null => readCookie(header, KEY);

export const readLastOpened = (): string | null => readCookieHere(KEY);
export const writeLastOpened = (id: string): void => writeCookie(KEY, id);
