/**
 * 쿠키 몇 개.
 *
 * 이 앱의 화면 설정은 거의 다 localStorage에 있다. **서버가 첫 HTML을 그릴 때
 * 알아야 하는 것만** 여기로 온다 — localStorage는 브라우저에만 있어서, 그것에
 * 기대면 서버는 늘 기본값으로 그리고 하이드레이션이 끝나서야 제 모습이 된다.
 * 열 때마다 한 번씩 덜컥거리던 것이 그 때문이었다.
 *
 * 쿠키는 정적 자산 요청까지 포함해 **모든 요청에 딸려 간다.** 그래서 여기 오는
 * 것은 열 바이트 남짓인 것들뿐이다. 원고도, 계정에 딸린 것도 오지 않는다.
 */

/**
 * 쿠키 헤더에서 하나를 뽑는다. 서버가 부르는 자리다.
 *
 * 이름이 겹쳐 보이는 쿠키에 속지 않게 경계를 짓는다 — `x_wongoji_panel`이 먼저
 * 걸리면 엉뚱한 값을 읽는다.
 */
export function readCookie(
	header: string | null | undefined,
	name: string,
): string | null {
	if (!header) return null;

	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		if (part.slice(0, eq).trim() !== name) continue;
		try {
			return decodeURIComponent(part.slice(eq + 1).trim());
		} catch {
			// 인코딩이 깨져 있으면 없는 것으로 본다
			return null;
		}
	}
	return null;
}

/** 한 해. 화면 설정이라 만료가 짧을 이유가 없다 */
const A_YEAR = 60 * 60 * 24 * 365;

/**
 * 브라우저에서 적는다.
 *
 * 서버를 거치지 않는다 — 서버가 알아야 하는 것은 **다음 요청**이고, 그때는
 * 쿠키가 저절로 딸려 간다. 이것 하나 적자고 왕복할 이유가 없다.
 *
 * `SameSite=Lax`로 남의 사이트에서 온 요청에는 딸려 가지 않게 하고, `Secure`는
 * https일 때만 붙인다 — 개발 서버는 http라 붙이면 아예 적히지 않는다.
 */
export function writeCookie(name: string, value: string): void {
	if (typeof document === "undefined") return;

	const secure = location.protocol === "https:" ? "; Secure" : "";
	/*
	 * biome은 Cookie Store API를 권한다. 쓰지 않는 이유는 사파리와 파이어폭스에
	 * 아직 없기 때문이다 — 원고를 쓰는 사람의 절반쯤이 거기 있다.
	 */
	// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store는 Safari·Firefox에 없다
	document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${A_YEAR}; SameSite=Lax${secure}`;
}

/** 브라우저에서 읽는다 */
export const readCookieHere = (name: string): string | null =>
	typeof document === "undefined" ? null : readCookie(document.cookie, name);

/**
 * 이제 아무도 읽지 않는 쿠키를 걷는다.
 *
 * `wongoji_last`는 `/`에 들어온 사람을 마지막으로 연 원고로 보내던 값이다. 그
 * 쪽이 서재로 바뀌면서 읽는 곳이 없어졌는데, **코드에서 지운다고 브라우저에
 * 있던 것까지 사라지지는 않는다** — 만료를 한 해로 두었으므로 그대로 두면 이미
 * 쓰던 사람의 모든 요청에 한 해 동안 딸려 간다. 정적 자산 요청까지 포함해서다.
 *
 * 적을 때와 **같은 `Path`·`SameSite`여야 지워진다.** 하나라도 다르면 브라우저는
 * 다른 쿠키로 보고 원래 것을 그대로 둔다.
 *
 * 언젠가 지울 코드다. 쓰던 사람의 브라우저를 한 번씩 지나고 나면 할 일이
 * 없어진다 — 2027년쯤 걷어도 잃을 것이 없다.
 */
export function sweepRetiredCookies(): void {
	if (typeof document === "undefined") return;

	for (const name of ["wongoji_last"]) {
		// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store는 Safari·Firefox에 없다
		document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
	}
}
