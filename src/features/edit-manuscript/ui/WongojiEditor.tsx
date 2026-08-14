import { Extension } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import {
	type Content,
	type Editor,
	EditorContent,
	useEditor,
} from "@tiptap/react";
import { CornerDownLeftIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import {
	BLANK_ROW_TYPE,
	type Block,
	blocksFromDoc,
} from "#/entities/manuscript";
import { Button } from "#/shared/ui/button";

/**
 * 원고지 에디터.
 *
 * 원고지에는 굵게·제목·목록 같은 것이 없으므로 스키마도 문단과 글자만 둔다.
 * 스키마에 없는 마크는 붙여넣기 단계에서 자동으로 떨어져 나가므로,
 * 서식 있는 글을 붙여 넣어도 평문으로 들어온다.
 */

/**
 * 빈 행 노드.
 *
 * HorizontalRule을 쓰되 `---` 자동 변환은 뺀다. 빈 행을 넣는 길은 버튼 하나뿐이어야
 * 배울 것이 없다. 마침 `--`는 줄표(―)로 조판되므로, 자동 변환이 없어야
 * 본문에 하이픈을 쓰는 것과도 부딪히지 않는다.
 */
const BlankRow = HorizontalRule.extend({
	addInputRules: () => [],
});

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
		.insertContent([{ type: BLANK_ROW_TYPE }, { type: "paragraph" }])
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

/**
 * 지금 내용을 알린다.
 *
 * JSON으로 한 번만 옮긴다. 저장할 값과 조판할 값이 같은 것에서 나오므로,
 * 둘을 따로 만들면 어긋날 자리가 생긴다.
 *
 * 컴포넌트 밖에 둔다. 안에 두면 그릴 때마다 새 함수가 되어, 아래 effect가
 * 그것을 의존값으로 삼는 순간 내용이 그대로인데도 알림이 다시 나간다.
 */
function announce(
	editor: Editor,
	notify: (blocks: Block[], doc: Content) => void,
): void {
	const doc = editor.state.doc.toJSON() as Content;
	notify(blocksFromDoc(doc), doc);
}

export interface WongojiEditorProps {
	initialContent: Content;
	/** 내용이 바뀌었다. 조판할 블록과 저장할 문서를 함께 넘긴다 */
	onChange: (blocks: Block[], doc: Content) => void;
	/**
	 * 커서가 몇 번째 top-level 노드에 있는가.
	 *
	 * 블록 번호가 아니라 **노드 번호**다 — 빈 문단은 조판에 실리지 않아 둘이
	 * 어긋나는데, 그 셈은 조판 쪽 규칙(`blockIndexAt`)이 알고 있다. 여기서는
	 * 에디터가 아는 것만 그대로 넘긴다.
	 */
	onCaret?: (nodeIndex: number) => void;
	/** 본문 오른쪽 아래에 겹쳐 띄울 것 (글자 수 등) */
	overlay?: React.ReactNode;
}

export function WongojiEditor({
	initialContent,
	onChange,
	onCaret,
	overlay,
}: WongojiEditorProps) {
	/*
	 * 알림 창구를 ref로 붙든다.
	 *
	 * onChange는 부모가 다시 그릴 때마다 새 함수가 된다. 이것을 아래 effect의
	 * 의존값으로 두면, 내용이 그대로인데도 "처음 조판" 알림이 다시 나간다. 원고를
	 * 바꾸는 순간이 특히 위험하다 — 아직 갈리지 않은 옛 에디터가 새 원고의 이름으로
	 * 옛 내용을 알려, 그 내용이 새 원고에 저장된다.
	 */
	const notify = useRef(onChange);
	notify.current = onChange;
	const caret = useRef(onCaret);
	caret.current = onCaret;

	const editor = useEditor({
		extensions: [
			Document,
			Paragraph,
			Text,
			BlankRow,
			BlankRowShortcut,
			UndoRedo,
			Placeholder.configure({
				placeholder: "여기에 글을 쓰면 원고지에 규칙대로 조판됩니다.",
			}),
		],
		content: initialContent,
		// SSR에서 곧바로 렌더하면 하이드레이션이 어긋난다
		immediatelyRender: false,
		editorProps: {
			attributes: {
				// 글 쓰는 곳이므로 본문 활자를 크게, 명조로, 줄을 넉넉히 둔다.
				// 높이는 부모가 준 만큼 채운다 — 상수로 박으면 화면 크기를 못 따라간다.
				class:
					"wongoji-prose h-full w-full overflow-y-auto rounded border border-border bg-[var(--paper)] px-5 py-4 text-base leading-8 outline-none focus:border-[var(--grid)]",
				spellcheck: "false",
			},
		},
		onUpdate: ({ editor }) => announce(editor, notify.current),
		// 글자를 치지 않고 커서만 옮겨도 알린다 — 자리를 옮긴 것도 "지금 여기"다
		onSelectionUpdate: ({ editor }) =>
			caret.current?.(editor.state.selection.$head.index(0)),
	});

	// 최초 마운트 시에도 한 번 조판한다 (onUpdate는 편집이 있어야 발생한다)
	useEffect(() => {
		if (editor) announce(editor, notify.current);
	}, [editor]);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/*
			 * 본문은 절대 배치로 이 상자를 꽉 채운다.
			 * flex 아이템은 height가 auto라 그 안에서 height:100%가 잡히지 않는다.
			 */}
			<div className="relative min-h-0 flex-1">
				<EditorContent editor={editor} className="absolute inset-0" />
				{overlay && (
					<div className="pointer-events-none absolute right-2 bottom-2">
						{overlay}
					</div>
				)}
			</div>
			{/*
			 * 빈 행을 넣는 유일한 길이다. 모바일에서 엄지가 닿도록 본문 바로 아래에
			 * 가로로 꽉 채워 둔다.
			 */}
			<Button
				variant="outline"
				size="lg"
				onClick={() => editor && insertBlankRow(editor)}
				disabled={!editor}
				title="Ctrl+Enter"
				className="mt-2 w-full border-[var(--grid)] bg-[var(--grid-soft)] text-xs hover:bg-[var(--grid)] hover:text-primary-foreground"
			>
				<CornerDownLeftIcon />빈 행 추가
				<span className="text-muted-foreground">⌃↵</span>
			</Button>
		</div>
	);
}
