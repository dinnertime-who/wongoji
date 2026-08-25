import { useCallback, useEffect, useRef, useState } from "react";
import { type FolderEntry, useArchiveMutation } from "#/entities/archive";
import { type Held, hold, keepHeld, shownName, toFlush } from "./editing";

/** 타이핑이 멎고 이만큼 뒤에 저장한다. 원고 제목과 같다 */
const DEBOUNCE = 300;

/**
 * 폴더 이름을 고친다.
 *
 * 화면에서 떼어 놓은 이유는 여기 든 것이 시간에 관한 규칙이기 때문이다 — 언제
 * 그리고, 언제까지 미루고, 언제 반드시 밀어 넣는가. 그리는 일과 섞어 두면
 * 어느 쪽이 어느 쪽을 깨뜨렸는지 알 수 없다.
 *
 * **"지금 무엇을 그릴까"는 이 파일이 정하지 않는다.** 그 판단은 순수 함수
 * (`editing.ts`)에 있고 여기서는 그것이 시키는 일을 할 뿐이다. 제목 칸이 글자마다
 * 서버를 왕복하던 시절에는, 늦게 온 응답이 방금 친 글자를 덮는 버그를 재현하려면
 * 브라우저에서 손으로 열 글자를 빠르게 치는 수밖에 없었다.
 */
export function useFolderName(folder: FolderEntry): {
	name: string;
	change: (next: string) => void;
} {
	const apply = useArchiveMutation();
	const [held, setHeld] = useState<Held | null>(null);
	/** 아직 응답이 오지 않은 flush. 놓는 판단은 `keepHeld`가 이 숫자를 본다 */
	const [inFlight, setInFlight] = useState(0);

	const folderRef = useRef(folder);
	folderRef.current = folder;

	/** 아직 쓰지 않은 이름. 어느 폴더 것인지 함께 들고 있다 */
	const pending = useRef<Held | null>(null);
	const saveTimer = useRef<number | undefined>(undefined);

	/**
	 * 기다리고 있는 이름을 지금 끝낸다.
	 *
	 * 밀린 이름은 자기가 어느 폴더 것인지 들고 있다. 폴더를 바꾸는 도중에 밀어
	 * 넣어도 옆 폴더에 쏟아지지 않는다.
	 *
	 * 밀어 넣는 자리에서는 화면에 든 값을 비우지 않는다. 정본이 따라잡고 떠
	 * 있는 flush가 없어지면 `keepHeld`가 놓는다.
	 */
	const flush = useCallback(async () => {
		const job = toFlush(pending.current, folderRef.current);
		pending.current = null;
		window.clearTimeout(saveTimer.current);
		saveTimer.current = undefined;
		if (!job) return;
		setInFlight((n) => n + 1);
		try {
			await apply({ kind: "renameFolder", id: job.folderId, name: job.name });
		} finally {
			setInFlight((n) => n - 1);
		}
	}, [apply]);

	/**
	 * 주소가 가리키는 폴더로 갈아탄다. 사이드바에서 다른 폴더를 고르면 다시 돈다.
	 *
	 * 저장 중인 것이 있으면 먼저 밀어 넣는다. 디바운스가 아직 안 터진 채로
	 * 폴더를 바꾸면 마지막 몇 글자가 사라진다. 화면에 든 값은 그릴 때
	 * `keepHeld`가 놓는다 — 따라잡는 것까지 effect에 넣으면 정본이 올 때마다
	 * 밀린 이름을 보내게 된다.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: flush는 이 폴더를 떠날 때만
	useEffect(() => {
		return () => {
			flush();
		};
	}, [folder.id, flush]);

	/*
	 * 화면을 떠날 때 마지막 몇 글자를 지킨다.
	 *
	 * `pagehide`만으로는 모자라다. 탭이 닫히는 중에 건 쓰기는 끝나지 못하고 잘릴
	 * 수 있다. `visibilitychange`가 먼저 오고 더 자주 오므로 그쪽에서도 밀어
	 * 넣는다 — 다른 탭으로 옮기거나 앱을 배경으로 내리는 것이 전부 여기로 온다.
	 */
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") flush();
		};
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", flush);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", flush);
			flush();
		};
	}, [flush]);

	const nextHeld = keepHeld(held, folder, inFlight);
	if (nextHeld !== held) {
		setHeld(nextHeld);
	}

	return {
		name: shownName(nextHeld, folder),
		change: (next: string) => {
			const value = hold(folder.id, next);
			pending.current = value;
			setHeld(value);
			window.clearTimeout(saveTimer.current);
			saveTimer.current = window.setTimeout(flush, DEBOUNCE);
		},
	};
}
