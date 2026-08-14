import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";

/**
 * 질의 캐시를 화면에 물린다.
 *
 * **캐시를 여기서 만들지 않는다.** 만드는 자리는 `router.tsx`이고, 이유는 라우트
 * 로더가 화면보다 먼저 돌기 때문이다 — 서버가 로더에서 색인과 본문을 미리 채워
 * 두려면 그때 이미 캐시가 있어야 하고, 그 캐시가 화면이 읽는 것과 같은 것이어야
 * 한다. 컴포넌트가 제 안에서 만들면 둘이 갈린다.
 *
 * 요청마다 새로 만드는 규칙은 그대로다. `getRouter()`가 요청마다 불린다.
 */
export function QueryProvider({
	client,
	children,
}: {
	client: QueryClient;
	children: React.ReactNode;
}) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
