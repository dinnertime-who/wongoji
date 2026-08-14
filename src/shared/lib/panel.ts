import { readCookie, readCookieHere, writeCookie } from "./cookie";

/**
 * 보관함을 어떻게 두었는가 — 접었는지, 폭이 얼마인지.
 *
 * **쿠키에 둔다.** 서버가 첫 HTML을 그릴 때 이 둘을 알아야 하기 때문이고,
 * 그 까닭은 [cookie.ts](./cookie.ts)에 적어 두었다.
 *
 * 값이 둘인데 쿠키를 하나만 쓰는 것은 둘이 늘 함께 읽히고 함께 쓰이기
 * 때문이다. 나누면 한쪽만 적힌 상태가 생긴다.
 */

export const PANEL_COOKIE = "wongoji_panel";

/** 적힌 적 없는 값은 null이다. **정한 적 없는 것과 정한 것은 다르다** */
export interface Panel {
	open: boolean | null;
	width: number | null;
}

const NOTHING: Panel = { open: null, width: null };

/** `1:320` — 접힘 한 글자, 콜론, 폭 */
export function formatPanel(panel: { open: boolean; width: number }): string {
	return `${panel.open ? 1 : 0}:${Math.round(panel.width)}`;
}

/**
 * 적힌 것을 읽는다.
 *
 * 사람이 손으로 고칠 수 있는 자리라 한 조각씩 가린다. 반만 읽히는 것도
 * 받아들인다 — 폭이 깨졌다고 접힘까지 버릴 이유가 없다.
 */
export function parsePanel(raw: string | null | undefined): Panel {
	if (!raw) return NOTHING;

	const [open, width] = raw.split(":");
	const px = Number(width);
	return {
		open: open === "1" ? true : open === "0" ? false : null,
		width: width && Number.isFinite(px) && px > 0 ? Math.round(px) : null,
	};
}

/** 쿠키 헤더에서 읽는다. **서버가 부르는 자리다** */
export const readPanel = (header: string | null | undefined): Panel =>
	parsePanel(readCookie(header, PANEL_COOKIE));

/** 브라우저에서 읽는다. 서버가 넘겨준 값이 있으면 그쪽이 먼저다 */
export const readPanelHere = (): Panel =>
	parsePanel(readCookieHere(PANEL_COOKIE));

export const writePanel = (panel: { open: boolean; width: number }): void =>
	writeCookie(PANEL_COOKIE, formatPanel(panel));
