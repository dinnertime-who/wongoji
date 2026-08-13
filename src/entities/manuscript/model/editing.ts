import type { Content } from "@tiptap/react";
import type { Block } from "../lib/typesetting";

/**
 * 원고 하나를 열어 고치고 있는 상태.
 *
 * **두 벌이 이 모양을 갖춘다.** 계정 보관함의 원고(`useManuscriptDoc`)와
 * 로그인 없이 쓰는 체험 원고(`useSoloDraft`)다. 저장하는 곳이 서버냐 이
 * 브라우저냐만 다르고, 화면이 필요로 하는 것은 똑같다.
 *
 * 그래서 이 타입이 여기(entity)에 있다. 두 피처가 서로를 부를 수 없으므로
 * 약속을 아래에 두고 각자 지킨다 — 화면은 어느 쪽을 받았는지 몰라도 된다.
 */

/** 원고를 열어 본 결과 */
export type Load =
	| { state: "loading" }
	| { state: "ready"; content: Content }
	/** 목록에는 있는데 본문이 없다 */
	| { state: "lost" }
	/**
	 * 본문이 있는 곳에 닿지 못했다.
	 *
	 * **`lost`와 반드시 갈라야 한다.** 뭉뚱그리면 연결이 잠깐 끊겼을 때 화면이
	 * "본문을 찾을 수 없습니다"를 띄우고, 거기서 "빈 원고로 시작"을 누르는 순간
	 * 멀쩡한 원고를 빈 것으로 덮는다.
	 */
	| { state: "unreachable" };

export interface ManuscriptEditing {
	load: Load;
	blocks: Block[];
	title: string;
	goal: number;
	/** 에디터를 다시 마운트시키는 열쇠 */
	editorKey: number;
	/** 에디터가 다시 마운트될 때 되살릴 내용 */
	content: Content | null;

	changeTitle: (value: string) => void;
	changeGoal: (value: number) => void;
	changeBody: (next: Block[], content: Content) => void;
	/** 불러오기로 통째로 갈아 끼운다 */
	replace: (title: string, blocks: Block[]) => void;
	/** 본문을 잃은 원고를 빈 원고로 되살린다 */
	startBlank: () => void;
	/** 밖에서 이 원고를 비웠다 */
	clearToBlank: (docId: string) => void;
}
