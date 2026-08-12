import { useEffect } from "react";
import { setStorageScope } from "#/shared/lib/storage";
import { useSession } from "./use-session";

/**
 * 로그인한 사람에 맞춰 보관함 칸을 고른다.
 *
 * 첫 그림에는 늦다 — 세션은 물어봐야 안다. 그동안은 저장소가 지난번 칸을
 * 되살려 쓰고 있고, 여기서는 세션이 도착한 뒤에 다른 경우에만 옮긴다. 대개는
 * 같아서 아무 일도 일어나지 않는다.
 *
 * 아직 모르는 동안 비로그인으로 내려 두지 않는다. 그러면 로그인한 사람이 남의
 * 보관함을 잠깐 보고, 그 사이에 보관함 세우기가 그 칸에 원고를 만든다.
 */
export function useArchiveScope() {
	const { data: session, isPending } = useSession();
	const userId = session?.user.id ?? null;

	useEffect(() => {
		if (isPending) return;
		setStorageScope(userId);
	}, [userId, isPending]);
}
