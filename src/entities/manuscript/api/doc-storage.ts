import {
	type SaveResult,
	safeGetItem,
	safeRemoveItem,
	safeSetItem,
} from "#/shared/lib/storage";

/**
 * 원고 본문을 저장소에 넣고 뺀다.
 *
 * 색인과 키를 나눈 이유는 저장 비용이다. 한 덩어리에 다 넣으면 글자 하나 칠
 * 때마다 전체를 다시 쓴다. 원고별로 나누면 그 원고만 쓴다.
 *
 * **회원 기능이 갈아끼울 지점이 여기다.** 색인 쪽과 함께 이 두 파일이 저장소를
 * 아는 전부다.
 */

/** 본문 키 앞머리. 고아를 찾을 때 이 값으로 훑으므로 한 곳에서만 정한다 */
export const DOC_PREFIX = "wongoji:v1:doc:";

const docKey = (id: string) => `${DOC_PREFIX}${id}`;

/** 본문 하나. Tiptap 문서를 그대로 담는다 */
export type DocContent = unknown;

export function readDoc(id: string): DocContent | null {
	const raw = safeGetItem(docKey(id));
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const writeDoc = (id: string, content: DocContent): SaveResult =>
	safeSetItem(docKey(id), JSON.stringify(content));

export const removeDoc = (id: string): void => safeRemoveItem(docKey(id));

/** 키에서 원고 id를 뽑는다. 본문 키가 아니면 null */
export const docIdFromKey = (key: string): string | null =>
	key.startsWith(DOC_PREFIX) ? key.slice(DOC_PREFIX.length) : null;
