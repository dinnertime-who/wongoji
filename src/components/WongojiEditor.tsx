import { Extension } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
	type Content,
	type Editor,
	EditorContent,
	useEditor,
} from "@tiptap/react";
import { useEffect } from "react";
import type { Block } from "#/lib/wongoji";

/**
 * 원고지 에디터.
 *
 * 원고지에는 굵게·제목·목록 같은 것이 없으므로 스키마도 문단과 글자만 둔다.
 * 스키마에 없는 마크는 붙여넣기 단계에서 자동으로 떨어져 나가므로,
 * 서식 있는 글을 붙여 넣어도 평문으로 들어온다.
 *
 * `---`는 Tiptap의 HorizontalRule 입력 규칙을 그대로 쓰되 의미만 빈 행으로 바꿔 읽는다.
 */

/**
 * 빈 행을 넣는다.
 *
 * 빈 행만 넣으면 커서가 그 앞에 남아 이어 친 글자가 앞 문단에 붙는다.
 * 새 문단을 함께 넣어 커서가 빈 행 다음에 놓이게 한다.
 */
function insertBlankRow(editor: Editor): boolean {
	return editor
		.chain()
		.focus()
		.insertContent([{ type: "horizontalRule" }, { type: "paragraph" }])
		.run();
}

/**
 * 빈 행 단축키.
 *
 * `Mod-Enter`는 맥에서 Cmd, 그 밖에서는 Ctrl로 잡힌다. 맥에서도 Ctrl을 쓰는 사람이
 * 있으므로 `Ctrl-Enter`도 함께 건다.
 */
const BlankRowShortcut = Extension.create({
	name: "blankRowShortcut",
	addKeyboardShortcuts() {
		const insert = () => insertBlankRow(this.editor);
		return { "Mod-Enter": insert, "Ctrl-Enter": insert };
	},
});

/** ProseMirror 문서를 조판 엔진의 블록 배열로 옮긴다 */
function docToBlocks(doc: PMNode): Block[] {
	const blocks: Block[] = [];
	doc.forEach((node) => {
		if (node.type.name === HorizontalRule.name) {
			blocks.push({ type: "blankRow" });
			return;
		}
		if (!node.isTextblock) return;
		const text = node.textContent.trim();
		if (text) blocks.push({ type: "paragraph", text });
	});
	return blocks;
}

export function WongojiEditor({
	initialContent,
	onChange,
	heightClass = "h-[60vh]",
}: {
	initialContent: Content;
	onChange: (blocks: Block[], doc: PMNode) => void;
	/** 서랍 안에서는 화면이 좁아 본문 높이를 줄여 쓴다 */
	heightClass?: string;
}) {
	const editor = useEditor({
		extensions: [
			Document,
			Paragraph,
			Text,
			HorizontalRule,
			BlankRowShortcut,
			UndoRedo,
			Placeholder.configure({
				placeholder:
					"여기에 글을 쓰면 오른쪽 원고지에 규칙대로 조판됩니다.\n빈 행이 필요하면 --- 또는 Ctrl+Enter.",
			}),
		],
		content: initialContent,
		// SSR에서 곧바로 렌더하면 하이드레이션이 어긋난다
		immediatelyRender: false,
		editorProps: {
			attributes: {
				class: `wongoji-prose ${heightClass} w-full overflow-y-auto rounded border border-[var(--hairline)] bg-[var(--paper)] p-3 text-sm leading-7 outline-none focus:border-[var(--grid)]`,
				spellcheck: "false",
			},
		},
		onUpdate: ({ editor }) =>
			onChange(docToBlocks(editor.state.doc), editor.state.doc),
	});

	// 최초 마운트 시에도 한 번 조판한다 (onUpdate는 편집이 있어야 발생한다)
	useEffect(() => {
		if (editor) onChange(docToBlocks(editor.state.doc), editor.state.doc);
	}, [editor, onChange]);

	return (
		<div>
			<div className="mb-2 flex items-baseline justify-between">
				<span className="text-[var(--muted)] text-xs">원고</span>
				<button
					type="button"
					onClick={() => editor && insertBlankRow(editor)}
					disabled={!editor}
					title="Ctrl+Enter"
					className="rounded border border-[var(--hairline)] px-2 py-0.5 text-[var(--muted)] text-xs transition-colors hover:bg-[var(--paper)] disabled:opacity-40"
				>
					빈 행 삽입 <span className="opacity-60">⌃↵</span>
				</button>
			</div>
			<EditorContent editor={editor} />
		</div>
	);
}
