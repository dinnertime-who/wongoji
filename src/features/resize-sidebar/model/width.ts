/**
 * 보관함 폭. 단위는 px다.
 *
 * shadcn 정본은 `16rem`을 모듈 상수로 박아 두고 CSS 변수 `--sidebar-width`로 꽂는다.
 * 그 변수만 덮으면 폭이 바뀌므로 `shared/ui/sidebar.tsx`는 손대지 않는다.
 *
 * **여기에 저장은 없다.** 접힘과 폭은 쿠키 하나에 함께 적히고(`shared/lib/panel`),
 * 그 쿠키를 쥐고 있는 것은 틀(`widgets/app-shell`)이다 — 서버가 첫 HTML을 그릴 때
 * 둘을 함께 읽어야 하기 때문이다. 이 파일에 남은 것은 **폭에 대한 규칙**뿐이다.
 */

export const SIDEBAR_DEFAULT = 256;

/**
 * 아래로는 트리가 읽히지 않고, 위로는 원고가 좁아진다.
 *
 * 위 끝을 480에 둔 것은 화면 경계가 1024라서다 — 거기서도 원고 쪽에 절반이 넘게
 * 남는다. 화면 폭에 비례해 정하지 않는 것은, 창을 줄였다 늘릴 때마다 사람이 정한
 * 값이 조용히 달라지기 때문이다.
 */
export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 480;

/** 범위 밖은 접는다. 소수점은 버린다 — CSS로 나갈 값이라 정수면 족하다 */
export const clampWidth = (px: number): number =>
	Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(px)));
