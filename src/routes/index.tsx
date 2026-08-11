import { createFileRoute } from "@tanstack/react-router";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Content } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportDialog } from "#/components/ExportDialog";
import { ManuscriptBar } from "#/components/ManuscriptBar";
import { RulesDialog } from "#/components/RulesDialog";
import { SaveErrorBanner } from "#/components/SaveErrorBanner";
import { Switch } from "#/components/ui/switch";
import { WongojiEditor } from "#/components/WongojiEditor";
import { WongojiPager } from "#/components/WongojiPager";
import { exportBackup, type Manuscript } from "#/lib/export";
import {
	type DocContent,
	mutateIndex,
	readDoc,
	requestPersistentStorage,
	type SaveFailure,
	type SaveResult,
	safeGetItem,
	safeSetItem,
	updateDoc,
	writeDoc,
	writeLastOpened,
} from "#/lib/store";
import { bootstrap } from "#/lib/store/bootstrap";
import { type Block, layoutBlocks, parseBlocks } from "#/lib/wongoji";

export const Route = createFileRoute("/")({ component: Home });

/** 화면 설정이라 원고와 무관하다. 보관함으로 옮기지 않는다 */
const PANE_KEY = "wongoji:mainPane";

const SAMPLE = `가을이 깊었다. 마당의 감나무가 잎을 다 떨구고 나서야 나는 그 사실을 알아차렸다.
"올해도 감은 안 열리려나?" 어머니가 물으셨다.
나는 대답 대신 하늘을 올려다보았다. 2024년의 마지막 가을이 그렇게 지나가고 있었다……`;

/** 모바일에서 화면 전체를 차지할 쪽 */
type Pane = "write" | "preview";

const PANE_LABEL: Record<Pane, string> = {
	write: "원고",
	preview: "원고지",
};

/** 블록 배열을 Tiptap 문서로. 빈 문서는 허용되지 않아 빈 문단 하나를 둔다. */
function blocksToDoc(blocks: Block[]): Content {
	const content = blocks.map((b) =>
		b.type === "blankRow"
			? { type: "horizontalRule" }
			: { type: "paragraph", content: [{ type: "text", text: b.text }] },
	);
	return {
		type: "doc",
		content: content.length ? content : [{ type: "paragraph" }],
	};
}

/**
 * Tiptap 문서에서 조판할 블록을 뽑는다.
 *
 * 에디터가 마운트되어 있지 않아도 조판할 수 있어야 한다. 모바일에서 원고지 쪽을
 * 보고 있으면 에디터는 렌더되지 않으므로, 에디터의 onChange만 믿으면 원고지가
 * 빈 채로 뜬다.
 */
function contentToBlocks(content: Content): Block[] {
	const nodes =
		content && typeof content === "object" && "content" in content
			? ((content.content ?? []) as Array<Record<string, unknown>>)
			: [];

	const blocks: Block[] = [];
	for (const node of nodes) {
		if (node.type === "horizontalRule") {
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
 * 보관함에서 읽은 본문을 에디터가 받을 수 있는 꼴로 만든다.
 *
 * 새 원고면 비어 있고, 아주 예전에는 평문으로 저장했으므로 셋을 모두 가린다.
 */
function toEditorContent(content: DocContent | null): Content {
	if (content == null) return blocksToDoc(parseBlocks(SAMPLE));
	if (typeof content === "string") return blocksToDoc(parseBlocks(content));
	if (
		typeof content === "object" &&
		(content as { type?: string }).type === "doc"
	) {
		return content as Content;
	}
	return blocksToDoc(parseBlocks(SAMPLE));
}

function Home() {
	const [initial, setInitial] = useState<Content | null>(null);
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [title, setTitle] = useState("");
	const [goal, setGoal] = useState(0);
	const [mainPane, setMainPane] = useState<Pane>("write");
	// 불러오기로 내용을 갈아끼울 때 에디터를 다시 마운트시키는 열쇠.
	// Tiptap은 만들어진 뒤 content 옵션을 다시 보지 않는다.
	const [editorKey, setEditorKey] = useState(0);
	// 저장이 실패하면 다시 성공할 때까지 화면에 남긴다
	const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
	/** 지금 열어 둔 원고 */
	const [docId, setDocId] = useState("");
	const saveTimer = useRef<number | undefined>(undefined);
	// 에디터는 쪽을 바꿀 때 다시 마운트된다. 그때 최신 내용으로 되살리려고 붙든다.
	const docRef = useRef<Content | null>(null);

	// localStorage는 브라우저에만 있으므로 마운트 후에 읽는다.
	useEffect(() => {
		// 보관함을 다듬고, 옛 원고를 옮겨 오거나 없으면 새로 만들고, 열 원고를 고른다
		const opened = bootstrap();
		if (!opened.result.ok) setSaveFailure(opened.result);

		const entry = opened.index.docs.find((d) => d.id === opened.docId);
		const content = toEditorContent(readDoc(opened.docId));

		setDocId(opened.docId);
		setInitial(content);
		docRef.current = content;
		// 에디터를 기다리지 않고 바로 조판한다
		setBlocks(contentToBlocks(content));
		setTitle(entry?.title ?? "");
		setGoal(entry?.goal ?? 0);
		writeLastOpened(opened.docId);

		const savedPane = safeGetItem(PANE_KEY);
		if (savedPane === "write" || savedPane === "preview")
			setMainPane(savedPane);

		// 용량이 부족할 때 브라우저가 원고를 먼저 지우지 않게 요청한다.
		// 거절되어도 알리지 않는다 — 사용자가 할 수 있는 조치가 없다.
		void requestPersistentStorage();
	}, []);

	/** 저장 결과를 화면에 반영한다. 하나라도 실패하면 배너가 남는다 */
	const report = useCallback((...results: SaveResult[]) => {
		const failed = results.find((r) => !r.ok);
		setSaveFailure(failed && !failed.ok ? failed : null);
	}, []);

	/**
	 * 본문과 색인을 함께 저장한다.
	 *
	 * 분량과 제목이 색인에도 있어서 저장이 두 키를 건드린다. 목록을 그릴 때 문서를
	 * 열지 않아도 되도록 치른 값이다. 같은 디바운스로 묶어 한 번에 쓴다.
	 */
	const persist = useCallback(
		(patch: { title?: string; goal?: number; content?: Content }) => {
			if (!docId) return;
			const results: SaveResult[] = [];
			if (patch.content !== undefined) {
				results.push(writeDoc(docId, patch.content));
			}
			results.push(
				mutateIndex((index) => updateDoc(index, docId, patch)).result,
			);
			report(...results);
		},
		[docId, report],
	);

	const handleChange = useCallback(
		(next: Block[], doc: PMNode) => {
			setBlocks(next);
			docRef.current = doc.toJSON() as Content;
			window.clearTimeout(saveTimer.current);
			saveTimer.current = window.setTimeout(() => {
				persist({ content: docRef.current ?? undefined });
			}, 300);
		},
		[persist],
	);

	const choosePane = (pane: Pane) => {
		setMainPane(pane);
		report(safeSetItem(PANE_KEY, pane));
	};

	const changeTitle = (value: string) => {
		setTitle(value);
		persist({ title: value });
	};

	const changeGoal = (value: number) => {
		setGoal(value);
		persist({ goal: value });
	};

	const handleImport = (next: Manuscript) => {
		const doc = blocksToDoc(next.blocks);
		setTitle(next.title);
		docRef.current = doc;
		setInitial(doc);
		setBlocks(next.blocks);
		persist({ title: next.title, content: doc });
		setEditorKey((k) => k + 1);
	};

	// 제목은 첫 장 헤더라 본문 앞에 붙는다. 비어 있으면 아예 넣지 않는다.
	const { pages, stats } = useMemo(
		() =>
			layoutBlocks([
				...(title.trim()
					? [{ type: "title" as const, text: title.trim() }]
					: []),
				...blocks,
			]),
		[blocks, title],
	);

	const statsText =
		goal > 0
			? `${stats.sheets} / ${goal}매`
			: `${stats.chars}자 · ${stats.sheets}매`;

	const editor = (overlay?: React.ReactNode) =>
		initial && (
			<WongojiEditor
				key={editorKey}
				initialContent={docRef.current ?? initial}
				onChange={handleChange}
				overlay={overlay}
			/>
		);

	const pager = <WongojiPager pages={pages} />;

	return (
		/*
		 * 화면 높이에 못박는다. min-h로 두면 위쪽 한계가 없어 안쪽 스크롤 영역이
		 * 자기 높이를 정하지 못하고, 원고지가 길어질 때 페이지 전체가 늘어난다.
		 */
		<div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
			<header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
				<div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
					<h1 className="font-semibold text-lg tracking-tight">200자 원고지</h1>
					<RulesDialog />
					<div className="ml-auto flex items-center gap-3 text-xs tabular-nums">
						<ExportDialog
							manuscript={{ title, blocks }}
							onImport={handleImport}
						/>
					</div>
				</div>
			</header>

			{saveFailure && (
				<SaveErrorBanner
					failure={saveFailure}
					onBackup={() => exportBackup({ title, blocks })}
				/>
			)}

			{/* 제목과 분량은 원고·원고지 어느 쪽을 보고 있든 늘 보여야 한다 */}
			<ManuscriptBar
				title={title}
				onTitleChange={changeTitle}
				goal={goal}
				onGoalChange={changeGoal}
				stats={stats}
			/>

			{/*
			 * 넓은 화면에서는 원고와 원고지를 나란히, 좁은 화면에서는 한 쪽만 보여준다.
			 *
			 * DOM은 한 벌만 두고 CSS로 가린다. 그래야 에디터가 늘 한 번만 마운트되어
			 * 쪽을 오가도 다시 만들어지지 않는다 — undo 히스토리도 살아남는다.
			 */}
			<main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-6 px-4 pt-4 pb-20 lg:grid-cols-2 lg:pb-6">
				<div
					className={`flex min-h-0 flex-col ${
						mainPane === "write" ? "" : "hidden lg:flex"
					}`}
				>
					{editor(
						<span className="rounded bg-background/85 px-1.5 py-0.5 text-[0.7rem] text-muted-foreground tabular-nums">
							{statsText}
						</span>,
					)}
				</div>
				<div
					className={`flex min-h-0 flex-col ${
						mainPane === "preview" ? "" : "hidden lg:flex"
					}`}
				>
					{pager}
				</div>
			</main>

			{/* 좁은 화면에서만 고른다. 넓은 화면에서는 둘 다 보이니 고를 것이 없다 */}
			<div className="fixed right-4 bottom-4 z-20 flex rounded-full border border-border bg-background px-3 py-2 shadow-lg lg:hidden">
				<PaneToggle mainPane={mainPane} onChoose={choosePane} />
			</div>
		</div>
	);
}

/** 두 쪽 중 하나를 고르는 것이라 스위치 양옆에 이름을 둔다 */
function PaneToggle({
	mainPane,
	onChoose,
}: {
	mainPane: Pane;
	onChoose: (pane: Pane) => void;
}) {
	const label = (pane: Pane) =>
		`text-xs transition-colors ${
			mainPane === pane ? "text-foreground" : "text-muted-foreground"
		}`;

	return (
		<div className="flex items-center gap-2">
			<button
				type="button"
				onClick={() => onChoose("write")}
				className={label("write")}
			>
				{PANE_LABEL.write}
			</button>
			<Switch
				checked={mainPane === "preview"}
				onCheckedChange={(on) => onChoose(on ? "preview" : "write")}
				aria-label="원고지 미리보기"
			/>
			<button
				type="button"
				onClick={() => onChoose("preview")}
				className={label("preview")}
			>
				{PANE_LABEL.preview}
			</button>
		</div>
	);
}
