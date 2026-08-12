import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
	readIndex,
	subscribeToIndex,
	useSaveStatus,
	writeIndex,
} from "#/entities/archive";
import {
	docQueryKey,
	readDoc,
	subscribeToDocWrites,
	writeDoc,
} from "#/entities/manuscript";
import { authClient } from "#/shared/api/auth-client";
import {
	fetchArchive,
	fetchDocContent,
	pushArchive,
	pushDocContent,
} from "../api/archive-api";

/** 색인을 밀어 넣기까지 기다리는 시간. 타이핑 한 번에 한 번씩 보내지 않는다 */
const PUSH_DEBOUNCE = 1500;

/**
 * 계정 보관함과 이 기기를 맞춘다.
 *
 * **읽기는 늘 로컬에서 한다.** 서버는 뒤에서 받아 로컬에 적을 뿐이고, 화면은
 * 색인이 바뀌었다는 알림을 통해 따라온다. 그래서 사이드바도 에디터도 이 기능을
 * 모른 채로 있다.
 *
 * 로그인하지 않았으면 아무 일도 하지 않는다 — 비로그인 원고는 이 브라우저 것이다.
 */
export function useArchiveSync() {
	/*
	 * 세션을 `#/features/auth`가 아니라 shared의 클라이언트에서 바로 받는다.
	 * feature는 다른 feature를 부를 수 없다 — 둘 다 세션을 알아야 하면 그것은
	 * 아래에 있어야 한다는 뜻이다.
	 */
	const { data: session } = authClient.useSession();
	const userId = session?.user.id ?? null;
	const { report } = useSaveStatus();
	const queryClient = useQueryClient();

	const pushTimer = useRef<number | undefined>(undefined);
	/** 이 계정으로 이미 받아 왔는가. 그릴 때마다 다시 받지 않는다 */
	const pulledFor = useRef<string | null>(null);

	/*
	 * 로그인하면 서버 것을 받아 로컬 계정 칸에 적는다.
	 *
	 * 받아 온 것이 정본이다. 이 칸은 계정 보관함의 사본일 뿐이라, 다른 기기에서
	 * 한 일이 여기 없으면 그것을 받아야 맞다.
	 */
	useEffect(() => {
		if (!userId || pulledFor.current === userId) return;
		pulledFor.current = userId;

		/*
		 * **cleanup에서 취소하지 않는다.**
		 *
		 * 취소 깃발을 두면 effect가 한 번 더 돌 때(StrictMode의 두 번 실행,
		 * 의존값이 바뀔 때) 진행 중이던 받아오기가 버려지는데, 바로 위 "이미
		 * 받아왔다" 가드에 걸려 다시 받지도 않는다 — 서버에 있는 원고가 영영
		 * 내려오지 않는다. `useManuscriptDoc`에서 같은 모양으로 한 번 겪었다.
		 *
		 * 대신 도착한 뒤에 아직 그 계정인지 본다. 계정을 바꿨으면 늦게 온 것은
		 * 남의 보관함이므로 버린다.
		 */
		(async () => {
			const remote = await fetchArchive();
			if (pulledFor.current !== userId) return;

			/*
			 * 서버가 비어 있는데 이 기기의 계정 칸에는 원고가 있으면 **덮지 않는다.**
			 *
			 * 아직 올리지 못한 원고다. 처음 로그인한 계정은 서버가 비어 있으므로,
			 * 받아 온 것을 그대로 적으면 방금 만든 원고가 사라지고 — 화면은 없는
			 * 원고를 가리킨 채 홈으로 튕겼다가 다시 만들기를 되풀이한다.
			 */
			const local = readIndex();
			const 서버가빔 =
				!remote.docs.length && !remote.folders.length && !remote.trash.length;
			const 로컬에있음 =
				local.docs.length || local.folders.length || local.trash.length;

			if (서버가빔 && 로컬에있음) {
				await pushArchive(local);
				return;
			}

			report(writeIndex(remote));

			/*
			 * 본문은 없는 것만 받는다. 이미 있는 것을 다시 받으면 아직 밀어 넣지
			 * 못한 이 기기의 마지막 몇 글자를 서버 것으로 덮는다.
			 */
			for (const doc of remote.docs) {
				if (pulledFor.current !== userId) return;
				if ((await readDoc(doc.id)) != null) continue;

				const content = await fetchDocContent(doc.id);
				if (content == null) continue;

				await writeDoc(doc.id, content);
				/*
				 * 캐시도 채운다. **이것이 없으면 화면이 "본문을 찾을 수 없습니다"에
				 * 머문다.** 에디터가 우리보다 먼저 읽어 없다고 본 뒤인데, 캐시는
				 * 스스로 낡지 않으므로(`staleTime: Infinity`) 다시 읽지 않는다.
				 */
				queryClient.setQueryData(docQueryKey(doc.id), content);
			}
		})().catch(() => {
			// 못 받아 왔으면 로컬에 있는 것으로 계속 쓴다. 다음 로그인에 다시 해 본다
			pulledFor.current = null;
		});
	}, [userId, report, queryClient]);

	/* 색인이 바뀌면 뒤에서 밀어 넣는다 */
	useEffect(() => {
		if (!userId) return;

		const schedule = () => {
			window.clearTimeout(pushTimer.current);
			pushTimer.current = window.setTimeout(() => {
				pushArchive(readIndex()).catch(() => {
					// 다음 변경에 다시 간다. 로컬에는 이미 저장되어 있다
				});
			}, PUSH_DEBOUNCE);
		};

		const offIndex = subscribeToIndex(schedule);
		const offDoc = subscribeToDocWrites((id) => {
			readDoc(id).then((content) => {
				if (content != null) pushDocContent(id, content).catch(() => {});
			});
		});

		return () => {
			offIndex();
			offDoc();
			window.clearTimeout(pushTimer.current);
		};
	}, [userId]);
}
