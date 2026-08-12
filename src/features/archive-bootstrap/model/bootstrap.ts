import {
	createDoc,
	readLastOpened,
	type StoreIndex,
	writeIndex,
} from "#/entities/archive";
import { type DocContent, emptyDoc, writeDoc } from "#/entities/manuscript";
import { type SaveResult, safeGetItem } from "#/shared/lib/storage";
import { tidy } from "./tidy";

/**
 * 앱이 뜰 때 한 번 — 보관함을 쓸 수 있는 상태로 만든다.
 *
 * 1. 색인을 다듬는다 (기한 지난 휴지통 비우기, 끊어진 경로 고치기, 고아 본문 지우기)
 * 2. 원고가 하나도 없으면 옛 원고를 옮겨 오거나, 없으면 새로 만든다
 * 3. 열 원고를 고른다
 */

/** 새 구조 이전에 쓰던 키들 */
const LEGACY = {
	draft: "wongoji:draft",
	title: "wongoji:title",
	goal: "wongoji:goal",
} as const;

export interface Bootstrap {
	/** 열어야 할 원고 */
	docId: string;
	/** 색인 저장 결과. 실패하면 부르는 쪽이 화면에 알린다 */
	result: SaveResult;
}

export async function bootstrap(now = Date.now()): Promise<Bootstrap> {
	const tidied = await tidy(now);

	/*
	 * 다듬기가 실패했으면 여기서 멈춘다.
	 *
	 * 이 아래는 "원고가 하나도 없으면 만든다"인데, 색인을 못 읽어 비어 보이는 것도
	 * 여기로 들어온다. 그대로 두면 멀쩡한 보관함 위에 새 원고 하나짜리 목록이 써진다.
	 */
	if (!tidied.result.ok) return { docId: "", result: tidied.result };

	let index = tidied.index;

	if (index.docs.length === 0) {
		const legacy = readLegacy();
		const created = createDoc(index, {
			title: legacy?.title ?? "",
			now,
		});
		index = created.index;

		/*
		 * 본문을 반드시 써 둔다. 색인에만 있고 본문 키가 없는 원고는 "본문을 잃었다"는
		 * 뜻으로 읽히므로, 갓 만든 원고가 그렇게 보여서는 안 된다.
		 */
		if (legacy) {
			// 옛 값을 그대로 옮긴다. 평문이든 Tiptap 문서든 읽는 쪽이 가린다.
			await writeDoc(created.doc.id, legacy.content);
			if (legacy.goal > 0) {
				index = {
					...index,
					docs: index.docs.map((d) =>
						d.id === created.doc.id ? { ...d, goal: legacy.goal } : d,
					),
				};
			}
		} else {
			/*
			 * 빈 원고로 시작한다.
			 *
			 * 전에는 처음 오는 사람에게 예시 글을 깔아 주었다. 조판이 어떻게 되는지
			 * 보여 주려던 것인데, 그것이 목록에서는 사람이 쓴 원고와 구별되지 않았다 —
			 * 로그인하면 한 자도 쓴 적 없는 사람에게 "이 원고를 계정으로 옮길까요?"를
			 * 묻고, 옮기면 예시 글이 진짜 원고가 되어 계정에 남았다.
			 */
			await writeDoc(created.doc.id, emptyDoc());
		}
	}

	return { docId: pickDoc(index), result: writeIndex(index) };
}

/**
 * 옛 키에서 원고를 읽는다.
 *
 * **읽기만 하고 지우지 않는다.** 서버 사본이 없는 마당에 되돌릴 길을 스스로 없앨
 * 이유가 없다. 한동안 두었다가 나중에 정리한다.
 */
function readLegacy(): {
	content: DocContent;
	title: string;
	goal: number;
} | null {
	const raw = safeGetItem(LEGACY.draft);
	if (!raw) return null;

	let content: DocContent = raw;
	try {
		const parsed = JSON.parse(raw);
		if (parsed?.type === "doc") content = parsed;
	} catch {
		// 평문이었다는 뜻이다. 그대로 넘긴다
	}

	return {
		content,
		title: safeGetItem(LEGACY.title) ?? "",
		goal: Number(safeGetItem(LEGACY.goal)) || 0,
	};
}

/** 마지막으로 열었던 것. 사라졌으면 가장 최근에 고친 것 */
function pickDoc(index: StoreIndex): string {
	const last = readLastOpened();
	if (last && index.docs.some((d) => d.id === last)) return last;

	const recent = [...index.docs].sort((a, b) => b.updatedAt - a.updatedAt)[0];
	return recent?.id ?? "";
}
