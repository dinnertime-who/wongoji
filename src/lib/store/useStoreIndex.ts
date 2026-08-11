import { useEffect, useState } from "react";
import { INDEX_KEY, readIndex, subscribeToIndex } from "./store";
import { emptyIndex, type StoreIndex } from "./types";

/**
 * 색인을 읽고, 바뀌면 따라간다.
 *
 * 두 갈래로 온다.
 * - **이 탭에서 고쳤을 때** — 저장소가 알려 준다
 * - **다른 탭에서 고쳤을 때** — `storage` 이벤트. 브라우저는 자기가 쓴 것에는
 *   이 이벤트를 주지 않으므로 두 갈래가 겹치지 않는다
 *
 * localStorage는 브라우저에만 있으므로 서버에서는 빈 색인으로 그린다.
 */
export function useStoreIndex(): StoreIndex {
	const [index, setIndex] = useState<StoreIndex>(emptyIndex);

	useEffect(() => {
		const refresh = () => setIndex(readIndex());
		refresh();

		const onStorage = (event: StorageEvent) => {
			if (event.key === null || event.key === INDEX_KEY) refresh();
		};
		window.addEventListener("storage", onStorage);
		const unsubscribe = subscribeToIndex(refresh);

		return () => {
			window.removeEventListener("storage", onStorage);
			unsubscribe();
		};
	}, []);

	return index;
}
