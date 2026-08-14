import { useState } from "react";
import { useOpenedEntry } from "./use-opened-entry";

/**
 * 보관함에서 고른 것.
 *
 * **`root`는 아무것도 안 고른 것이다.** 눈에 보이지 않는 맨 위 폴더라, "선택
 * 없음"과 "맨 위를 고름"을 다른 값으로 둘 이유가 없다 — 둘로 두면 새 원고가
 * 어디에 생기는지 묻는 자리마다 두 경우를 다 따져야 한다.
 */
export type Picked =
	| { kind: "root" }
	| { kind: "folder"; id: string }
	| { kind: "doc"; id: string };

export interface Selection {
	picked: Picked;
	/** 이 줄이 고른 것인가 */
	has: (kind: "doc" | "folder", id: string) => boolean;
	/**
	 * 이 줄을 골랐다.
	 *
	 * 주소를 따라가는 것만으로는 모자란다 — **이미 열어 둔 줄을 다시 누르면 주소가
	 * 안 바뀐다.** 빈 곳을 눌러 선택을 지운 뒤 보고 있던 원고를 도로 누르는 것이
	 * 그 경우인데, 눌린 자리에서 알려 주지 않으면 아무 일도 일어나지 않는다.
	 */
	pick: (kind: "doc" | "folder", id: string) => void;
	/** 아무것도 안 고른 것으로 되돌린다. 그 자리가 맨 위다 */
	clear: () => void;
}

const keyOf = (docId: string, folderId?: string) =>
	`${folderId ?? ""}\n${docId}`;

/**
 * 사이드바의 선택.
 *
 * **주소에서 시작하되 제 상태로 든다.** 전에는 선택이 곧 주소였다 — 열어 둔 줄이
 * 곧 골라 둔 줄이었고, 그래서 **고른 것을 지울 길이 없었다.** 로그인하면 홈이
 * 마지막 원고로 튕기므로(`HomePage`) 아무것도 안 열린 화면 자체가 없고, 결국
 * 폴더를 열어 둔 채로 맨 위에 만들 방법이 사라진다.
 *
 * 그것을 우회하려고 "맨 위에 만들기" 모드를 따로 두었더니, 열어 둔 줄과 빈 곳이
 * **같은 색으로 동시에** 켜졌다. 선택이 옮겨 간 것이 아니라 선택이 둘이 되었다.
 * 값을 하나로 모으면 그럴 수가 없다.
 *
 * 주소는 여전히 기본이다. 무엇을 열면 그것을 고른 것이다.
 */
export function useSelection(): Selection {
	const { docId, folderId } = useOpenedEntry();
	const opened: Picked = folderId
		? { kind: "folder", id: folderId }
		: docId
			? { kind: "doc", id: docId }
			: { kind: "root" };

	const [picked, setPicked] = useState<Picked>(opened);

	/*
	 * 주소가 바뀌면 거기로 옮겨 간다.
	 *
	 * **effect로 하지 않는다.** effect는 그려진 뒤에 돌아서, 다른 원고를 연 첫
	 * 프레임에 옛 선택이 그대로 보인다. 그리는 중에 맞추면 React가 화면에
	 * 내보내기 전에 한 번 더 돌아 그 깜빡임이 없다.
	 */
	const [seen, setSeen] = useState(() => keyOf(docId, folderId));
	const key = keyOf(docId, folderId);
	if (seen !== key) {
		setSeen(key);
		setPicked(opened);
	}

	return {
		picked,
		has: (kind, id) =>
			picked.kind !== "root" && picked.kind === kind && picked.id === id,
		pick: (kind, id) => setPicked({ kind, id }),
		clear: () => setPicked({ kind: "root" }),
	};
}
