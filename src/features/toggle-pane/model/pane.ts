import { safeGetItem, savePreference } from "#/shared/lib/storage";

/** 화면 설정이라 원고와 무관하다. 보관함으로 옮기지 않는다 */
const PANE_KEY = "wongoji:mainPane";

/** 좁은 화면에서 화면 전체를 차지할 쪽 */
export type Pane = "write" | "preview";

export const PANE_LABEL: Record<Pane, string> = {
	write: "원고",
	preview: "원고지",
};

export function readPane(): Pane | null {
	const saved = safeGetItem(PANE_KEY);
	return saved === "write" || saved === "preview" ? saved : null;
}

/** 실패해도 알리지 않는다 — 다음에 열 때 기본값으로 시작한다는 뜻일 뿐이다 */
export const writePane = (pane: Pane): void => savePreference(PANE_KEY, pane);
