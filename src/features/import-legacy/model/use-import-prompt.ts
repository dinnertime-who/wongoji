import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ARCHIVE_KEY } from "#/entities/archive";
import { authClient } from "#/shared/api/auth-client";
import { importLegacyIntoAccount, pendingUpload } from "./import-legacy";

/**
 * 로그인했을 때 이 브라우저에 두고 온 옛 원고를 옮길지 묻는다.
 *
 * 전에는 이 훅이 **보관함이 열리는 시점까지 붙들고 있었다.** 저장하는 자리가
 * 로그인 여부에 따라 갈렸기 때문에, 어느 칸인지 확정되기 전에 보관함을 세우면
 * 엉뚱한 곳에 빈 원고가 생겼다. 이제 보관함은 서버 하나뿐이라 묻는 동안에도
 * 화면은 제 갈 길을 간다 — 붙들 것이 없다.
 */
export function useImportPrompt() {
	const { data: session, isPending } = authClient.useSession();
	const userId = session?.user.id ?? null;
	const client = useQueryClient();

	const [ask, setAsk] = useState<{ docs: number; folders: number } | null>(
		null,
	);
	const [working, setWorking] = useState(false);

	useEffect(() => {
		if (isPending || !userId) return;

		const waiting = pendingUpload();
		if (waiting.docs || waiting.folders) setAsk(waiting);
	}, [userId, isPending]);

	return {
		ask,
		working,
		accept: async () => {
			setWorking(true);
			try {
				await importLegacyIntoAccount();
				// 올라간 것을 받아 온다. 서버가 정본이므로 다시 물어보면 된다
				await client.invalidateQueries({ queryKey: ARCHIVE_KEY });
			} finally {
				setWorking(false);
				setAsk(null);
			}
		},
		/** 옮기지 않는다. 옛 원고는 이 브라우저에 그대로 남는다 */
		decline: () => setAsk(null),
	};
}
