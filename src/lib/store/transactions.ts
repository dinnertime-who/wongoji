import { emptyDoc } from "#/lib/tiptap";
import type { SaveResult } from "#/shared/lib/storage";
import { createDoc, duplicateDoc } from "./operations";
import { mutateIndex, readDoc, writeDoc } from "./store";
import type { Path, StoreIndex } from "./types";

/**
 * 색인과 본문을 함께 건드리는 일들.
 *
 * `operations.ts`는 색인만 다루는 순수 함수라 본문 키를 모른다. 본문까지 함께
 * 움직여야 하는 것은 여기에 둔다. 화면 여러 곳에서 같은 순서를 각자 적으면
 * 반드시 갈라지므로 — 실제로 갈라져 있었다 — 한 벌만 둔다.
 *
 * 저장이 실패하면 **되돌린다.** 목록에는 있는데 본문 키가 없는 원고는 "본문을
 * 잃었다"는 뜻으로 읽히므로, 갓 만든 원고가 그렇게 보여서는 안 된다.
 */

const dropDoc = (id: string) => (index: StoreIndex) => ({
	...index,
	docs: index.docs.filter((d) => d.id !== id),
});

/** 만들어진 원고. 실패했으면 `docId`가 빈 문자열이다 */
export interface Created {
	docId: string;
	result: SaveResult;
}

/** 그 폴더 안에 빈 원고를 만든다 */
export function createDocIn(path: Path, now?: number): Created {
	let docId = "";
	const { result } = mutateIndex((current) => {
		const made = createDoc(current, { path, now });
		docId = made.doc.id;
		return made.index;
	});
	if (!result.ok) return { docId: "", result };

	const body = writeDoc(docId, emptyDoc());
	if (!body.ok) {
		mutateIndex(dropDoc(docId));
		return { docId: "", result: body };
	}
	return { docId, result: body };
}

/** 원고를 복제한다. 본문까지 함께 뜬다 */
export function duplicateDocById(id: string, now?: number): Created {
	// 본문을 먼저 읽는다. 색인만 늘려 놓고 못 읽으면 빈 사본이 남는다
	const body = readDoc(id);

	let copyId = "";
	const { result } = mutateIndex((current) => {
		const made = duplicateDoc(current, id, now);
		if (!made) return current;
		copyId = made.doc.id;
		return made.index;
	});
	if (!result.ok) return { docId: "", result };
	// 없는 원고를 복제하려 했다. 실패는 아니지만 갈 곳도 없다
	if (!copyId) return { docId: "", result };

	const written = writeDoc(copyId, body ?? emptyDoc());
	if (!written.ok) {
		mutateIndex(dropDoc(copyId));
		return { docId: "", result: written };
	}
	return { docId: copyId, result: written };
}
