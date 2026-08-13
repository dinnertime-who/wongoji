import type { DocStatus, StoreIndex } from "#/entities/archive";

/**
 * 원고의 이력과 되돌리기.
 *
 * 색인 연산(`/api/archive/ops`)이 아니라 본문 라우트 아래로 간다 — 버전이 담는
 * 것이 본문이고, 되돌리기도 본문을 갈아 끼우는 일이다.
 */

/** 이력 한 줄. **본문은 없다** — 목록이 원고 수만큼 무거워지지 않게 발췌만 온다 */
export interface DocVersion {
	id: string;
	/** `status`(상태를 올림) 또는 `backup`(되돌리기 직전) */
	kind: string;
	status: DocStatus | null;
	title: string;
	excerpt: string;
	chars: number;
	sheets: number;
	createdAt: number;
}

const url = (docId: string) =>
	`/api/archive/doc/${encodeURIComponent(docId)}/versions`;

export const versionsQueryKey = (docId: string) =>
	["doc-versions", docId] as const;

export async function fetchVersions(docId: string): Promise<DocVersion[]> {
	const response = await fetch(url(docId));
	if (!response.ok)
		throw new Error(`이력을 받지 못했습니다 (${response.status})`);

	const { versions } = (await response.json()) as { versions: DocVersion[] };
	return versions;
}

/**
 * 되돌렸다고 알린다.
 *
 * 서버의 본문이 갈렸는데, 에디터는 "이미 앉힌 원고는 다시 앉히지 않는다"고
 * 정해 두어서 화면이 그대로 남는다. 되돌리는 것도 피처, 원고를 쓰는 것도
 * 피처라 서로 부를 수 없으니 — 둘을 아는 쪽(page)이 이어 준다.
 */
type Restored = (docId: string) => void;
const listeners = new Set<Restored>();

export function onDocRestored(listener: Restored): () => void {
	listeners.add(listener);
	return () => void listeners.delete(listener);
}

/** 그때로 되돌린다. 바뀐 뒤의 색인이 온다 */
export async function restoreVersion(
	docId: string,
	versionId: string,
): Promise<StoreIndex> {
	const response = await fetch(url(docId), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ versionId }),
	});
	if (!response.ok) throw new Error(`되돌리지 못했습니다 (${response.status})`);

	const { index } = (await response.json()) as { index: StoreIndex };

	for (const listener of listeners) {
		try {
			listener(docId);
		} catch {
			// 듣는 쪽 사정이다. 되돌리기는 이미 끝났다
		}
	}
	return index;
}
