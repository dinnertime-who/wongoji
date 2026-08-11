import { createFileRoute } from "@tanstack/react-router";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Content } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportDialog } from "#/components/ExportDialog";
import { RulesDialog } from "#/components/RulesDialog";
import { WongojiEditor } from "#/components/WongojiEditor";
import { WongojiPager } from "#/components/WongojiPager";
import { useMediaQuery } from "#/hooks/useMediaQuery";
import type { Manuscript } from "#/lib/export";
import { type Block, layoutBlocks, parseBlocks } from "#/lib/wongoji";

export const Route = createFileRoute("/")({ component: Home });

const STORAGE_KEY = "wongoji:draft";
const PANE_KEY = "wongoji:mainPane";
const TITLE_KEY = "wongoji:title";
const AFFILIATION_KEY = "wongoji:affiliation";

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
	const [affiliation, setAffiliation] = useState("");
	const [mainPane, setMainPane] = useState<Pane>("write");
	// 불러오기로 내용을 갈아끼울 때 에디터를 다시 마운트시키는 열쇠.
	// Tiptap은 만들어진 뒤 content 옵션을 다시 보지 않는다.
	const [editorKey, setEditorKey] = useState(0);
	const saveTimer = useRef<number | undefined>(undefined);
	// 에디터는 쪽을 바꿀 때 다시 마운트된다. 그때 최신 내용으로 되살리려고 붙든다.
	const docRef = useRef<Content | null>(null);

	const isDesktop = useMediaQuery("(min-width: 1024px)", true);

	// localStorage는 브라우저에만 있으므로 마운트 후에 읽는다.
	useEffect(() => {
		const draft = loadDraft(window.localStorage.getItem(STORAGE_KEY));
		setInitial(draft);
		docRef.current = draft;
		// 에디터를 기다리지 않고 바로 조판한다
		setBlocks(contentToBlocks(draft));

		setTitle(window.localStorage.getItem(TITLE_KEY) ?? "");
		setAffiliation(window.localStorage.getItem(AFFILIATION_KEY) ?? "");

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

	const changeAffiliation = (value: string) => {
		setAffiliation(value);
		window.localStorage.setItem(AFFILIATION_KEY, value);
	};

	const handleImport = (next: Manuscript) => {
		const doc = blocksToDoc(next.blocks);
		changeTitle(next.title);
		changeAffiliation(next.affiliation);
		docRef.current = doc;
		setInitial(doc);
		setBlocks(next.blocks);
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
		setEditorKey((k) => k + 1);
	};

	// 제목·소속은 첫 장 헤더라 본문 앞에 붙는다. 비어 있으면 아예 넣지 않는다.
	const { pages, stats } = useMemo(
		() =>
			layoutBlocks([
				...(title.trim()
					? [{ type: "title" as const, text: title.trim() }]
					: []),
				...(affiliation.trim()
					? [{ type: "affiliation" as const, text: affiliation.trim() }]
					: []),
				...blocks,
			]),
		[blocks, title, affiliation],
	);

	const statsText = `${stats.chars}자 · ${stats.sheets}매 · ${stats.pages}장`;

	const editor = (heightClass?: string, overlay?: React.ReactNode) =>
		initial && (
			<WongojiEditor
				key={editorKey}
				initialContent={docRef.current ?? initial}
				onChange={handleChange}
				heightClass={heightClass}
				title={title}
				onTitleChange={changeTitle}
				affiliation={affiliation}
				onAffiliationChange={changeAffiliation}
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
						{/* 모바일에서는 본문 오른쪽 아래에 겹쳐 띄우므로 헤더에서 뺀다 */}
						{isDesktop && (
							<span className="text-[var(--muted)]">{statsText}</span>
						)}
						<ExportDialog
							manuscript={{ title, affiliation, blocks }}
							onImport={handleImport}
						/>
						<button
							type="button"
							onClick={() => window.print()}
							className="rounded border border-[var(--hairline)] px-3 py-1 transition-colors hover:bg-[var(--paper)]"
						>
							인쇄
						</button>
					</div>
				</div>
			</header>

			{isDesktop ? (
				/*
				 * w-full이 없으면 안 된다. 바깥이 flex 컨테이너라 mx-auto의 auto 마진이
				 * stretch를 눌러, main이 늘어나지 않고 콘텐츠 크기로 줄어든다.
				 */
				<main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
					<div className="no-print lg:sticky lg:top-20 lg:self-start">
						{editor()}
					</div>
					<div className="min-w-0">{pager}</div>
				</main>
			) : (
				<>
					{/*
					 * 원고지는 열 줄이라 화면 위쪽에 붙어 있으면 아래가 크게 빈다.
					 * 남은 높이를 flex로 받아 세로 가운데에 놓는다 — 헤더 높이를 상수로
					 * 박으면 글자 수가 늘어 헤더가 접힐 때 어긋난다.
					 */}
					<main className="flex flex-1 flex-col justify-center px-4">
						{mainPane === "write" ? (
							/* 아래 여백은 떠 있는 토글이 빈 행 추가 버튼을 가리지 않도록 둔다 */
							<div className="no-print pt-4 pb-20">
								{editor(
									"h-[calc(100dvh-22rem)]",
									<span className="rounded bg-[var(--canvas)]/85 px-1.5 py-0.5 text-[var(--muted)] text-[0.7rem] tabular-nums">
										{statsText}
									</span>,
								)}
							</div>
						) : (
							/*
							 * 위아래 여백이 같아야 헤더 아래 영역의 한가운데에 온다.
							 * 넉넉히 두는 쪽은 장이 많아 아래로 넘칠 때 장 번호 막대가
							 * 떠 있는 토글에 가리지 않게 하려는 것이다.
							 */
							<div className="min-w-0 py-20">{pager}</div>
						)}
					</main>

					{/* 엄지가 닿는 자리에 둔다 */}
					<div className="no-print fixed right-4 bottom-4 z-20 flex rounded-full border border-[var(--hairline)] bg-[var(--canvas)] p-1 shadow-lg">
						{(["write", "preview"] as const).map((pane) => (
							<button
								key={pane}
								type="button"
								onClick={() => choosePane(pane)}
								aria-pressed={mainPane === pane}
								className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
									mainPane === pane
										? "bg-[var(--ink)] text-[var(--paper)]"
										: "text-[var(--muted)]"
								}`}
							>
								{PANE_LABEL[pane]}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}
