import { useEffect, useState } from "react";
import { writeIndex } from "#/entities/archive";
import { authClient } from "#/shared/api/auth-client";
import { markScopeSettled, setStorageScope } from "#/shared/lib/storage";
import { fetchArchive } from "../api/archive-api";
import { mergeLocalIntoAccount, pendingUpload } from "./merge";

/**
 * 로그인했을 때 이 기기에 두고 온 원고를 옮길지 묻는다.
 *
 * **이것이 끝나야 보관함이 열린다.** 묻는 동안 칸을 확정하지 않으므로 보관함
 * 세우기가 기다린다 — 아니면 답하기도 전에 빈 원고가 만들어지고, 옮기고 나면
 * 쓰지도 않은 "제목 없는 원고"가 목록에 남는다.
 *
 * 주고받는 일(`useArchiveSync`)과 나눠 둔 이유는 필요한 것이 다르기 때문이다.
 * 그쪽은 저장 실패를 알릴 자리가 있어야 해서 `_app` 안에서만 살 수 있는데,
 * 묻는 일은 그보다 먼저, 홈에서도 떠 있어야 한다.
 */
export function useMergePrompt() {
	const { data: session, isPending } = authClient.useSession();
	const userId = session?.user.id ?? null;

	const [ask, setAsk] = useState<{ docs: number; folders: number } | null>(
		null,
	);
	const [merging, setMerging] = useState(false);

	useEffect(() => {
		if (isPending) return;

		/*
		 * 확정하기 전에 칸을 직접 맞춘다.
		 *
		 * 칸을 정하는 것은 `useArchiveScope`의 일이지만 둘 다 root의 effect라
		 * 어느 쪽이 먼저 도는지가 트리 모양에 달려 있다. 뒤집히면 틀린 칸인 채로
		 * "확정"이 서고 보관함 세우기가 거기에 원고를 만든다. 같은 값이면 아무
		 * 일도 일어나지 않으므로 여기서 한 번 더 맞추는 값이 싸다.
		 */
		setStorageScope(userId);

		// 비로그인이면 물을 것이 없다. 바로 연다
		if (!userId) {
			markScopeSettled();
			return;
		}

		const waiting = pendingUpload();
		if (waiting.docs || waiting.folders) {
			setAsk(waiting);
			return; // 답을 받을 때까지 확정하지 않는다
		}
		markScopeSettled();
	}, [userId, isPending]);

	const done = () => {
		setAsk(null);
		markScopeSettled();
	};

	return {
		ask,
		merging,
		accept: async () => {
			setMerging(true);
			try {
				await mergeLocalIntoAccount();
				// 올린 것이 계정 색인에 들어왔다. 그것으로 보관함을 연다
				writeIndex(await fetchArchive());
			} finally {
				setMerging(false);
				done();
			}
		},
		/** 옮기지 않는다. 비로그인 원고는 그 칸에 그대로 남는다 */
		decline: done,
	};
}
