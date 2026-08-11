import { createFileRoute } from "@tanstack/react-router";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Content } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportDialog } from "#/components/ExportDialog";
import { ManuscriptBar } from "#/components/ManuscriptBar";
import { RulesDialog } from "#/components/RulesDialog";
import { Button } from "#/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { WongojiEditor } from "#/components/WongojiEditor";
import { WongojiPager } from "#/components/WongojiPager";
import type { Manuscript } from "#/lib/export";
import { type Block, layoutBlocks, parseBlocks } from "#/lib/wongoji";

export const Route = createFileRoute("/")({ component: Home });

const STORAGE_KEY = "wongoji:draft";
const PANE_KEY = "wongoji:mainPane";
const TITLE_KEY = "wongoji:title";
const GOAL_KEY = "wongoji:goal";

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
 * 저장된 원고를 읽는다.
 *
 * 예전에는 평문 문자열을 저장했으므로 JSON이 아니면 평문으로 보고 옮겨 담는다.
 */
function loadDraft(raw: string | null): Content {
	if (!raw) return blocksToDoc(parseBlocks(SAMPLE));
	try {
		const parsed = JSON.parse(raw);
		if (parsed?.type === "doc") return parsed as Content;
	} catch {
		// 평문이었다는 뜻이다
	}
	return blocksToDoc(parseBlocks(raw));
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
	const saveTimer = useRef<number | undefined>(undefined);
	// 에디터는 쪽을 바꿀 때 다시 마운트된다. 그때 최신 내용으로 되살리려고 붙든다.
	const docRef = useRef<Content | null>(null);

	// localStorage는 브라우저에만 있으므로 마운트 후에 읽는다.
	useEffect(() => {
		const draft = loadDraft(window.localStorage.getItem(STORAGE_KEY));
		setInitial(draft);
		docRef.current = draft;
		// 에디터를 기다리지 않고 바로 조판한다
		setBlocks(contentToBlocks(draft));

		setTitle(window.localStorage.getItem(TITLE_KEY) ?? "");
		setGoal(Number(window.localStorage.getItem(GOAL_KEY)) || 0);

		const savedPane = window.localStorage.getItem(PANE_KEY);
		if (savedPane === "write" || savedPane === "preview")
			setMainPane(savedPane);
	}, []);

	const handleChange = useCallback((next: Block[], doc: PMNode) => {
		setBlocks(next);
		docRef.current = doc.toJSON() as Content;
		window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(docRef.current));
		}, 300);
	}, []);

	const choosePane = (pane: Pane) => {
		setMainPane(pane);
		window.localStorage.setItem(PANE_KEY, pane);
	};

	const changeTitle = (value: string) => {
		setTitle(value);
		window.localStorage.setItem(TITLE_KEY, value);
	};

	const changeGoal = (value: number) => {
		setGoal(value);
		window.localStorage.setItem(GOAL_KEY, String(value));
	};

	const handleImport = (next: Manuscript) => {
		const doc = blocksToDoc(next.blocks);
		changeTitle(next.title);
		docRef.current = doc;
		setInitial(doc);
		setBlocks(next.blocks);
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
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
		<div className="flex min-h-[100dvh] flex-col bg-[var(--canvas)] text-[var(--ink)]">
			<header className="no-print sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--canvas)]/90 backdrop-blur">
				<div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
					<h1 className="font-semibold text-lg tracking-tight">200자 원고지</h1>
					<RulesDialog />
					<div className="ml-auto flex items-center gap-3 text-xs tabular-nums">
						<ExportDialog
							manuscript={{ title, blocks }}
							onImport={handleImport}
						/>
						<Button variant="outline" size="sm" onClick={() => window.print()}>
							인쇄
						</Button>
					</div>
				</div>
			</header>

			{/* 제목과 분량은 원고·원고지 어느 쪽을 보고 있든 늘 보여야 한다 */}
			<ManuscriptBar
				title={title}
				onTitleChange={changeTitle}
				goal={goal}
				onGoalChange={changeGoal}
				stats={stats}
				toggle={
					<div className="hidden shrink-0 rounded-full border border-[var(--hairline)] bg-[var(--paper)] p-1 lg:flex">
						<PaneToggle mainPane={mainPane} onChoose={choosePane} />
					</div>
				}
			/>

			{/*
			 * 한 번에 한 쪽만 전체 폭으로 보여준다. 쓰는 것이 주고 원고지는 확인이라
			 * 나란히 두면 정작 글 쓰는 곳이 좁아진다.
			 *
			 * 덤으로 에디터가 항상 하나만 마운트되므로 화면 크기로 갈라줄 필요가 없다.
			 * 토글은 상태가 없으니 CSS로 자리만 바꿔 준다.
			 */}
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-4 pb-20 lg:pb-6">
				{mainPane === "write" ? (
					<div className="no-print flex min-h-0 flex-1 flex-col">
						{editor(
							<span className="rounded bg-[var(--canvas)]/85 px-1.5 py-0.5 text-[var(--muted)] text-[0.7rem] tabular-nums">
								{statsText}
							</span>,
						)}
					</div>
				) : (
					/* 원고지는 열 줄이라 위에만 붙어 있으면 아래가 크게 빈다 */
					<div className="flex min-h-0 flex-1 flex-col justify-center">
						{pager}
					</div>
				)}
			</main>

			{/* 좁은 화면에서는 엄지가 닿는 자리에 띄운다 */}
			<div className="no-print fixed right-4 bottom-4 z-20 flex rounded-full border border-[var(--hairline)] bg-[var(--canvas)] p-1 shadow-lg lg:hidden">
				<PaneToggle mainPane={mainPane} onChoose={choosePane} />
			</div>
		</div>
	);
}

function PaneToggle({
	mainPane,
	onChoose,
}: {
	mainPane: Pane;
	onChoose: (pane: Pane) => void;
}) {
	return (
		<ToggleGroup
			type="single"
			value={mainPane}
			// 라디오처럼 늘 하나가 눌려 있어야 한다. 빈 값이 오면 무시한다.
			onValueChange={(value) => value && onChoose(value as Pane)}
			className="rounded-full"
		>
			{(["write", "preview"] as const).map((pane) => (
				<ToggleGroupItem
					key={pane}
					value={pane}
					className="rounded-full px-3.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
				>
					{PANE_LABEL[pane]}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
