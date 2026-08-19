import { createFileRoute } from "@tanstack/react-router";
import { WRITING_LOG_KEY } from "#/entities/writing-log";
import { LibraryPage } from "#/pages/library";
import { loadWritingLog } from "./-boot";

export const Route = createFileRoute("/_app/library")({
	/**
	 * 잔디를 **화면보다 먼저** 받아 둔다. `_app`이 색인에 하는 것과 같다.
	 *
	 * 캐시에 넣는 것이 요점이다 — 화면은 `useWritingLog()`로 읽고 그것이 여기서
	 * 채운 것을 그대로 집는다(`staleTime: Infinity`라 다시 묻지 않는다). 이 두
	 * 줄이 `router.tsx`의 `dehydrate`/`hydrate`를 지나 브라우저로 간다.
	 */
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData({
			queryKey: WRITING_LOG_KEY,
			queryFn: loadWritingLog,
		});
	},
	component: LibraryPage,
});
