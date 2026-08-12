import { mutateIndex, updateDoc } from "#/entities/archive";
import { emptyDoc, writeDoc } from "#/entities/manuscript";
import type { SaveResult } from "#/shared/lib/storage";

/**
 * 하나뿐인 원고를 비운다. 버리는 대신이다.
 *
 * 원고가 없는 화면은 있을 수 없어 버리자마자 빈 원고가 새로 생긴다. 그러면
 * 목록에 그대로 "제목 없는 원고"가 남아 아무 일도 없었던 것처럼 보인다. 버리는
 * 시늉 대신 초기화라고 적고 실제로 비운다.
 *
 * **비운 것을 알린다.** 저장소만 고치면 그 원고를 열어 둔 에디터가 옛 내용을
 * 그대로 들고 있다가 다음 타이핑에 되살려 놓는다. 화면을 쥔 쪽이 함께 갈아
 * 끼워야 하는데, 그쪽은 보관함에서 멀리 떨어져 있다 — 콜백을 물려주려면 그
 * 사이의 모든 부품이 초기화를 아는 척해야 하므로 이렇게 알린다.
 */

type Listener = (docId: string) => void;
const listeners = new Set<Listener>();

/** 어떤 원고가 비워졌는지 듣는다 */
export function onDocReset(listener: Listener): () => void {
	listeners.add(listener);
	return () => void listeners.delete(listener);
}

export function resetDoc(docId: string): SaveResult {
	const body = writeDoc(docId, emptyDoc());
	if (!body.ok) return body;

	const { result } = mutateIndex((current) =>
		updateDoc(current, docId, { title: "", goal: 0, chars: 0, sheets: 1 }),
	);
	if (!result.ok) return result;

	for (const listener of listeners) {
		try {
			listener(docId);
		} catch {
			// 듣는 쪽 사정이다. 저장은 이미 끝났다
		}
	}
	return result;
}
