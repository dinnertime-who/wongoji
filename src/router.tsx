import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * 라우터에게 "이것은 JSON이다"라고 말하는 자리.
 *
 * `dehydrate()`가 돌려주는 것은 타입상 `unknown`을 품고 있어(질의 키도 상태도
 * 무엇이든 될 수 있으므로) 라우터의 직렬화 검사를 통과하지 못한다. 실제로 담기는
 * 것은 서버가 D1에서 읽어 온 색인과 본문 — **애초에 JSON이었던 것**뿐이다.
 */
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/**
 * 질의 캐시.
 *
 * **요청마다 새로 만든다.** 모듈 최상단에 두면 서버에서 한 벌을 모든 사람이
 * 나눠 쓰게 되어, 남의 원고가 남의 화면에 실린다. `getRouter()`가 요청마다
 * 불리므로 여기가 그 자리다.
 *
 * 기본값이 네트워크를 겨냥해 잡혀 있는데, 이 앱이 캐시에 두는 것은 서버가 이미
 * 정본으로 들고 있는 것이거나 이 브라우저 안에 있는 것이다.
 *
 * - `staleTime: Infinity` — 쓰는 쪽이 캐시를 함께 갱신하므로 다시 읽을 이유가
 *   없다. **로더가 채워 둔 것을 하이드레이션 직후에 다시 묻지 않는 것도 이 값이
 *   한다**
 * - `retry: false` — IndexedDB가 거절하면 다시 물어도 같은 답이다
 */
function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: Number.POSITIVE_INFINITY,
				retry: false,
				refetchOnWindowFocus: false,
			},
		},
	});
}

export function getRouter() {
	const queryClient = makeQueryClient();

	const router = createTanStackRouter({
		routeTree,
		context: { queryClient },
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,

		/*
		 * 서버가 로더에서 채워 둔 질의를 브라우저로 넘긴다.
		 *
		 * 라우터는 제 로더가 돌려준 것만 알아서 실어 보낸다. 로더가 **질의
		 * 캐시에 채운 것**은 라우터 바깥의 일이라, 이 두 줄이 없으면 브라우저가
		 * 하이드레이션하자마자 색인과 본문을 다시 묻는다 — 미리 받아 둔 뜻이
		 * 없어진다.
		 */
		dehydrate: () => ({ queries: dehydrate(queryClient) as unknown as Json }),
		hydrate: (dehydrated) =>
			hydrate(queryClient, dehydrated.queries as unknown as DehydratedState),
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
