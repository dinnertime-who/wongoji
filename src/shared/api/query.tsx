import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * 질의 캐시.
 *
 * 기본값이 네트워크를 겨냥해 잡혀 있는데, 이 앱이 묻는 곳은 대부분 이 브라우저
 * 안이다 — 원고 본문은 IndexedDB에 있다. 그대로 두면 창을 다시 볼 때마다,
 * 마운트할 때마다 저장소를 다시 읽고 그때 화면이 한 번 흔들린다.
 *
 * - `staleTime: Infinity` — 로컬 저장소는 저 혼자 바뀌지 않는다. 쓰는 쪽이
 *   캐시를 함께 갱신하므로 다시 읽을 이유가 없다
 * - `retry: false` — IndexedDB가 거절하면 다시 물어도 같은 답이다. 사생활 보호
 *   모드에서 저장소가 아예 없는 것이 그런 경우다
 *
 * 서버로 나가는 질의가 생기면 그쪽은 부르는 자리에서 따로 정한다. 재시도와
 * 백오프가 필요한 것은 그쪽이다.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
	/*
	 * 요청마다 새로 만든다. 모듈 최상단에 두면 서버에서 한 벌을 모든 사람이
	 * 나눠 쓰게 되어, 남의 원고가 남의 화면에 실린다.
	 */
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: Number.POSITIVE_INFINITY,
						retry: false,
						refetchOnWindowFocus: false,
					},
				},
			}),
	);

	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
