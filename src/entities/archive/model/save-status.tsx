import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { SaveFailure, SaveResult } from "#/shared/lib/storage";

/**
 * 보관함 저장이 실패했는지.
 *
 * 배너 하나를 화면 위쪽에 띄우려고 실패를 알리는 창구가 필요한데, 고치는 곳은
 * 트리 깊숙한 데(사이드바 · 휴지통 · 폴더 쪽)에 흩어져 있다. 콜백을 물려주면
 * 그 사이의 모든 부품이 저장 실패를 아는 척해야 한다 — 실제로 그랬고, 통과만
 * 시키는 prop이 네 겹이었다.
 *
 * **화면 설정은 여기로 오지 않는다.** 사이드바 접힘 같은 것은 못 적어도 알릴
 * 값이 없다(`savePreference`). 여기 오는 것은 원고를 잃을 수 있는 실패뿐이다.
 */

interface SaveStatus {
	failure: SaveFailure | null;
	/** 저장 결과를 알린다. 성공하면 배너가 사라진다 */
	report: (...results: SaveResult[]) => void;
	/**
	 * 배너의 "백업 받기"가 부를 것.
	 *
	 * 내려받을 원고가 있는 쪽만 등록한다 — 폴더 쪽에서 실패하는 것은 색인이라
	 * 백업할 본문이 없다. 떠날 때 `null`로 지운다.
	 */
	registerBackup: (backup: (() => void) | null) => void;
	backup: (() => void) | null;
}

const Context = createContext<SaveStatus | null>(null);

export function SaveStatusProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [failure, setFailure] = useState<SaveFailure | null>(null);
	const [backup, setBackup] = useState<(() => void) | null>(null);

	// 하나라도 실패하면 배너가 남는다. 다시 성공할 때까지 사라지지 않는다
	const report = useCallback((...results: SaveResult[]) => {
		const failed = results.find((r) => !r.ok);
		setFailure(failed && !failed.ok ? failed : null);
	}, []);

	// 함수를 state에 담으므로 갱신 함수 꼴로 넣는다. 그냥 넘기면 React가 부른다
	const registerBackup = useCallback(
		(next: (() => void) | null) => setBackup(() => next),
		[],
	);

	const value = useMemo(
		() => ({ failure, report, backup, registerBackup }),
		[failure, report, backup, registerBackup],
	);
	return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSaveStatus(): SaveStatus {
	const status = useContext(Context);
	if (!status) {
		throw new Error("SaveStatusProvider 안에서만 쓸 수 있습니다");
	}
	return status;
}

/*
 * 색인을 고치는 일은 여기 없다. `useArchiveMutation`은 `use-archive.ts`에 있다 —
 * 고치는 것이 저장소 쓰기가 아니라 서버로 보내는 일이 되면서, 질의 캐시를 아는
 * 쪽으로 옮겨 갔다. 여기 남은 것은 "실패를 화면에 알리는 창구" 하나다.
 */
