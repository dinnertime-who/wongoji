import { useSyncExternalStore } from "react";
import {
	INDEX_KEY,
	indexSnapshot,
	subscribeToIndex,
} from "../api/index-storage";
import { emptyIndex, type StoreIndex } from "./types";

/**
 * 색인을 읽고, 바뀌면 따라간다.
 *
 * 두 갈래로 온다.
 * - **이 탭에서 고쳤을 때** — 저장소가 알려 준다
 * - **다른 탭에서 고쳤을 때** — `storage` 이벤트. 브라우저는 자기가 쓴 것에는
 *   이 이벤트를 주지 않으므로 두 갈래가 겹치지 않는다
 *
 * 부르는 곳이 여럿이어도 값싸다. `indexSnapshot`이 원본 문자열을 견주어 바뀌지
 * 않았으면 같은 객체를 돌려주므로, 색인을 부르는 수만큼 다시 파싱하지 않는다.
 * 화면 곳곳에서 마음 놓고 부를 수 있어야 색인을 prop으로 물려줄 이유가 없어진다.
 */
function subscribe(onChange: () => void): () => void {
	const onStorage = (event: StorageEvent) => {
		if (event.key === null || event.key === INDEX_KEY) onChange();
	};
	window.addEventListener("storage", onStorage);
	const unsubscribe = subscribeToIndex(onChange);

	return () => {
		window.removeEventListener("storage", onStorage);
		unsubscribe();
	};
}

/** localStorage는 브라우저에만 있으므로 서버에서는 빈 색인으로 그린다 */
const SERVER = emptyIndex();

export function useStoreIndex(): StoreIndex {
	return useSyncExternalStore(subscribe, indexSnapshot, () => SERVER);
}
