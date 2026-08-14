import { safeGetItem, savePreference } from "#/shared/lib/storage";

/** 화면 설정이라 원고와 무관하다. 보관함으로 옮기지 않는다 */
const WIDTH_KEY = "wongoji:sidebarWidth";

/**
 * 보관함 폭. 단위는 px다.
 *
 * shadcn 정본은 `16rem`을 모듈 상수로 박아 두고 CSS 변수 `--sidebar-width`로 꽂는다.
 * 그 변수만 덮으면 폭이 바뀌므로 `shared/ui/sidebar.tsx`는 손대지 않는다.
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

/**
 * 적힌 값을 폭으로 읽는다. 읽을 수 없으면 null이다.
 *
 * 사람이 손으로 고칠 수 있는 자리라 숫자인지부터 본다. 범위를 벗어난 값은
 * 버리지 않고 접는다 — 저장한 뒤에 상·하한을 바꿨을 수 있고, 그때 폭을
 * 기본값으로 되돌리는 것보다 가까운 쪽에 세우는 편이 덜 놀랍다.
 */
export function parseWidth(raw: string | null): number | null {
	if (raw === null || raw.trim() === "") return null;
	const px = Number(raw);
	return Number.isFinite(px) ? clampWidth(px) : null;
}

export const readWidth = (): number | null =>
	parseWidth(safeGetItem(WIDTH_KEY));

/** 실패해도 알리지 않는다 — 다음에 열 때 기본값으로 시작한다는 뜻일 뿐이다 */
export const writeWidth = (px: number): void =>
	savePreference(WIDTH_KEY, String(clampWidth(px)));
