import type { Content } from "@tiptap/react";
import { type Block, parseBlocks } from "./typesetting";

/**
 * 에디터 문서(Tiptap)와 조판 블록 사이를 옮긴다.
 *
 * 두 방향 다 **JSON 형태 위에서** 한다. ProseMirror 노드로 하면 에디터가 떠
 * 있을 때만 쓸 수 있는데, 저장소에서 갓 읽은 본문에도 같은 변환이 필요하다 —
 * 모바일에서 원고지 쪽을 보고 있으면 에디터는 마운트되지 않는다.
 *
 * 규칙이 세 벌로 흩어져 있었다. 같은 세 줄을 손으로 세 번 적으면 언젠가 갈라진다.
 */

/**
 * 빈 행 노드의 이름.
 *
 * `HorizontalRule`을 그대로 쓰므로 이름도 그것이다. 문자열을 여기저기 박지 않고
 * 이 상수를 본다 — 에디터 확장과 변환기가 서로 다른 이름을 보면 빈 행이 사라진다.
 */
export const BLANK_ROW_TYPE = "horizontalRule";

/**
 * 빈 원고.
 *
 * Tiptap은 빈 문서를 허용하지 않아 빈 문단 하나를 둔다. 갓 만든 원고의 본문
 * 키에도 이것을 쓴다 — 키가 아예 없으면 "본문을 잃었다"는 뜻이 되기 때문이다.
 * 부르는 쪽이 고쳐 쓰지 않도록 매번 새로 만든다.
 */
export const emptyDoc = (): Content => ({
	type: "doc",
	content: [{ type: "paragraph" }],
});

/** 조판 블록 → 에디터 문서 */
export function blocksToDoc(blocks: Block[]): Content {
	const content = blocks.map((b) =>
		b.type === "blankRow"
			? { type: BLANK_ROW_TYPE }
			: { type: "paragraph", content: [{ type: "text", text: b.text }] },
	);
	return content.length ? { type: "doc", content } : emptyDoc();
}

/**
 * 에디터 문서 → 조판 블록.
 *
 * 빈 문단은 버린다. 원고지에서 문단은 들여쓰기로 표시하지 빈 줄로 표시하지
 * 않으므로, Enter를 두 번 친 자리가 원고지 위에 남아서는 안 된다.
 */
export function blocksFromDoc(content: Content): Block[] {
	const nodes =
		content && typeof content === "object" && "content" in content
			? ((content.content ?? []) as Array<Record<string, unknown>>)
			: [];

	const blocks: Block[] = [];
	for (const node of nodes) {
		if (node.type === BLANK_ROW_TYPE) {
			blocks.push({ type: "blankRow" });
			continue;
		}
		const inline = (node.content ?? []) as Array<{ text?: string }>;
		const text = inline
			.map((n) => n.text ?? "")
			.join("")
			.trim();
		if (text) blocks.push({ type: "paragraph", text });
	}
	return blocks;
}

/**
 * 보관함에서 읽은 본문을 에디터가 받을 수 있는 꼴로.
 *
 * 아주 예전에는 평문으로 저장했으므로 그 경우도 가린다.
 */
export function toEditorContent(stored: unknown): Content {
	if (typeof stored === "string") return blocksToDoc(parseBlocks(stored));
	if (
		stored != null &&
		typeof stored === "object" &&
		(stored as { type?: string }).type === "doc"
	) {
		return stored as Content;
	}
	return emptyDoc();
}
