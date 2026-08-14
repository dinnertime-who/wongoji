import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useUserId } from "#/shared/api/session";
import type { SaveResult } from "#/shared/lib/storage";
import {
	ARCHIVE_KEY,
	fetchArchive,
	type OpResult,
	sendOp,
} from "../api/archive-api";
import { type ArchiveOp, applyOp } from "./ops";
import { useSaveStatus } from "./save-status";
import { emptyIndex, type StoreIndex } from "./types";

/**
 * 계정 보관함을 읽고 고친다.
 *
 * **정본은 서버에 있고 여기 있는 것은 캐시다.** 그래서 화해할 일이 없다 — 고치는
 * 길이 `useArchiveMutation` 하나이고, 그 끝에서 서버가 돌려준 것이 캐시가 된다.
 */

/** 아직 못 받았을 때 그릴 것. 매번 새로 만들면 그것이 다시 그릴 이유가 된다 */
const EMPTY = emptyIndex();

const UNREACHABLE: SaveResult = {
	ok: false,
	kind: "offline",
	message:
		"보관함을 서버에 저장하지 못했습니다. 연결을 확인해 주세요 — 방금 한 것은 되돌렸습니다.",
};

/**
 * 지금 보관함.
 *
 * `isPending`을 함께 돌려주는 것이 중요하다. **아직 못 받은 것과 비어 있는 것은
 * 다르다** — 구별하지 않으면 목록을 그리는 쪽은 "이 원고는 없다"고 보고 홈으로
 * 돌려보내고, 홈은 "보관함이 비었다"고 보고 원고를 새로 만든다.
 */
export function useArchive(): { index: StoreIndex; isPending: boolean } {
	const userId = useUserId();

	const { data, isPending } = useQuery({
		queryKey: ARCHIVE_KEY,
		queryFn: fetchArchive,
		// 비로그인은 계정 보관함이 없다. 물어봐야 401이다
		enabled: Boolean(userId),
	});

	return {
		index: data ?? EMPTY,
		/*
		 * 누구인지는 서버가 첫 HTML에 실어 보내므로 여기서 기다리지 않는다. 전에는
		 * "세션을 묻는 동안"이라는 국면이 하나 더 있었고, 그동안 이 값이 참이라
		 * 보관함을 그리는 쪽이 통째로 멈춰 있었다.
		 *
		 * 질의를 끄면 react-query는 `isPending`을 계속 참으로 둔다. 그래서 켜져
		 * 있을 때만 그 값을 본다 — 비로그인은 "다 알고 있다"가 맞다.
		 */
		isPending: Boolean(userId) && isPending,
	};
}

/**
 * 보관함을 고친다. **무엇이 바뀌었는지가 아니라 무엇을 했는지를 보낸다.**
 *
 * 응답을 기다리는 동안 화면을 미리 고쳐 둔다(낙관적 갱신). 미리 고치는 계산과
 * 서버가 하는 계산이 **같은 `applyOp`**라 둘이 어긋날 수 없다 — 낙관적 갱신에서
 * 가장 자주 나는 버그가 여기서 없어진다.
 *
 * 실패하면 고치기 전으로 되돌리고 배너에 알린다. 되돌리는 것이 맞는 이유는
 * 서버가 정본이기 때문이다. 화면에만 남겨 두면 다음 새로고침에 사라지는데,
 * 그것이 사용자에게는 "했던 일이 없던 일이 되었다"로 보인다.
 */
export function useArchiveMutation(): (
	op: ArchiveOp,
) => Promise<OpResult | null> {
	const client = useQueryClient();
	const { report } = useSaveStatus();

	return useCallback(
		async (op: ArchiveOp) => {
			const before = client.getQueryData<StoreIndex>(ARCHIVE_KEY) ?? EMPTY;

			/*
			 * **만드는 연산은 미리 그리지 않는다.**
			 *
			 * id를 서버가 정하기 때문이다. 미리 그리면 잠깐 임시 id를 단 줄이
			 * 목록에 보이는데, 그 사이에 눌리면 없는 주소로 간다. 만드는 쪽은
			 * 어차피 응답을 기다렸다가 그 원고를 여니 기다려도 손해가 없다.
			 */
			const guesses = !MAKES_ID.has(op.kind);
			if (guesses) {
				client.setQueryData(ARCHIVE_KEY, applyOp(before, op).index);
			}

			try {
				const result = await sendOp(op);
				client.setQueryData(ARCHIVE_KEY, result.index);
				report({ ok: true });
				return result;
			} catch {
				if (guesses) client.setQueryData(ARCHIVE_KEY, before);
				report(UNREACHABLE);
				return null;
			}
		},
		[client, report],
	);
}

const MAKES_ID = new Set<ArchiveOp["kind"]>([
	"createDoc",
	"createFolder",
	"duplicateDoc",
]);
