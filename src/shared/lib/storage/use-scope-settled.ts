import { useSyncExternalStore } from "react";
import { scopeSettled, subscribeToScope } from "./scope";

/**
 * 칸이 확정되었는가 — 세션이 도착해 어느 보관함인지 정해졌는가.
 *
 * **원고를 만들어 내는 일은 이것을 기다려야 한다.** 그 전까지 저장소는 지난번
 * 칸을 쓰고 있는데, 로그인해서 막 돌아온 사람에게는 그것이 틀린 칸이다. 그때
 * 보관함을 세우면 비로그인 칸에 빈 원고가 생기고, 칸이 옮겨진 뒤 그 원고를
 * 찾지 못해 화면이 왕복한다.
 *
 * 읽기만 하는 곳은 기다릴 필요가 없다. 틀린 칸을 잠깐 보는 것은 되돌릴 수 있지만
 * 틀린 칸에 쓴 것은 그렇지 않다.
 */
export function useScopeSettled(): boolean {
	return useSyncExternalStore(
		subscribeToScope,
		scopeSettled,
		// 서버에는 저장소가 없다. 확정될 일도 없다
		() => false,
	);
}
