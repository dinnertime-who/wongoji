import { createFileRoute } from "@tanstack/react-router";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Content } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RulesDialog } from "#/components/RulesDialog";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "#/components/ui/drawer";
import { WongojiEditor } from "#/components/WongojiEditor";
import { WongojiPager } from "#/components/WongojiPager";
import { useMediaQuery } from "#/hooks/useMediaQuery";
import { type Block, layoutBlocks, parseBlocks } from "#/lib/wongoji";

export const Route = createFileRoute("/")({ component: Home });

const STORAGE_KEY = "wongoji:draft";
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
	const [mainPane, setMainPane] = useState<Pane>("write");
	const [drawerOpen, setDrawerOpen] = useState(false);
	const saveTimer = useRef<number | undefined>(undefined);
	// 에디터는 서랍과 본문 사이를 오갈 때 다시 마운트된다. 그때 최신 내용으로 되살리려고 붙든다.
	const docRef = useRef<Content | null>(null);

	const isDesktop = useMediaQuery("(min-width: 1024px)", true);

	// localStorage는 브라우저에만 있으므로 마운트 후에 읽는다.
	useEffect(() => {
		setInitial(loadDraft(window.localStorage.getItem(STORAGE_KEY)));
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
		setDrawerOpen(false);
		window.localStorage.setItem(PANE_KEY, pane);
	};

	const { pages, stats } = useMemo(() => layoutBlocks(blocks), [blocks]);

	const otherPane: Pane = mainPane === "write" ? "preview" : "write";

	const editor = (heightClass?: string) =>
		initial && (
			<WongojiEditor
				initialContent={docRef.current ?? initial}
				onChange={handleChange}
				heightClass={heightClass}
			/>
		);

	const pager = <WongojiPager pages={pages} />;

	return (
		<div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
			<header className="no-print sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--canvas)]/90 backdrop-blur">
				<div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
					<h1 className="font-semibold text-lg tracking-tight">200자 원고지</h1>
					<RulesDialog />
					<div className="ml-auto flex items-center gap-3 text-xs tabular-nums">
						<span className="text-[var(--muted)]">
							{stats.chars}자 · {stats.sheets}매 · {stats.pages}장
						</span>
						<button
							type="button"
							onClick={() => window.print()}
							className="rounded border border-[var(--hairline)] px-3 py-1 transition-colors hover:bg-[var(--paper)]"
						>
							인쇄
						</button>
					</div>
				</div>

				{/* 모바일: 어느 쪽을 전체 화면에 둘지 고르고, 나머지는 서랍으로 본다 */}
				{!isDesktop && (
					<div className="flex items-center gap-2 px-4 pb-2">
						<div className="flex rounded border border-[var(--hairline)] p-0.5">
							{(["write", "preview"] as const).map((pane) => (
								<button
									key={pane}
									type="button"
									onClick={() => choosePane(pane)}
									className={`rounded px-2.5 py-1 text-xs transition-colors ${
										mainPane === pane
											? "bg-[var(--ink)] text-[var(--paper)]"
											: "text-[var(--muted)]"
									}`}
								>
									{PANE_LABEL[pane]}
								</button>
							))}
						</div>
						<button
							type="button"
							onClick={() => setDrawerOpen(true)}
							className="ml-auto rounded border border-[var(--hairline)] px-3 py-1 text-xs transition-colors hover:bg-[var(--paper)]"
						>
							{PANE_LABEL[otherPane]} 열기
						</button>
					</div>
				)}
			</header>

			{isDesktop ? (
				<main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
					<div className="no-print lg:sticky lg:top-20 lg:self-start">
						{editor()}
						<EditorHint />
					</div>
					<div className="min-w-0">{pager}</div>
				</main>
			) : (
				<>
					<main className="px-4 py-4">
						{mainPane === "write" ? (
							<div className="no-print">
								{editor("h-[calc(100vh-16rem)]")}
								<EditorHint />
							</div>
						) : (
							<div className="min-w-0">{pager}</div>
						)}
					</main>

					<Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
						<DrawerContent className="max-h-[85vh]">
							<DrawerHeader>
								<DrawerTitle className="text-sm">
									{PANE_LABEL[otherPane]}
								</DrawerTitle>
							</DrawerHeader>
							<div className="overflow-y-auto px-4 pb-6">
								{otherPane === "write" ? (
									<div className="no-print">
										{editor("h-[50vh]")}
										<EditorHint />
									</div>
								) : (
									pager
								)}
							</div>
						</DrawerContent>
					</Drawer>
				</>
			)}
		</div>
	);
}

function EditorHint() {
	return (
		<p className="mt-2 text-[var(--muted)] text-xs leading-5">
			줄바꿈이 문단이 됩니다. 원고지에서 문단은 들여쓰기로 표시하므로 빈 줄을
			쳐도 빈 행이 생기지 않습니다. 빈 행이 필요하면 <code>---</code> 또는
			Ctrl+Enter — 운문의 연 사이나 긴 인용의 위아래에 씁니다.
		</p>
	);
}
