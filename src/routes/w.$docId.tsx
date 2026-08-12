import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Content } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Breadcrumb } from "#/components/Breadcrumb";
import { CapacityMeter } from "#/components/CapacityMeter";
import { CopyManuscript } from "#/components/CopyManuscript";
import { ExportDialog } from "#/components/ExportDialog";
import { ManuscriptBar } from "#/components/ManuscriptBar";
import { RulesDialog } from "#/components/RulesDialog";
import { SaveErrorBanner } from "#/components/SaveErrorBanner";
import { Shell } from "#/components/Shell";
import { Button } from "#/components/ui/button";
import { SidebarTrigger } from "#/components/ui/sidebar";
import { Switch } from "#/components/ui/switch";
import { WongojiEditor } from "#/components/WongojiEditor";
import { WongojiPager } from "#/components/WongojiPager";
import { exportBackup, type Manuscript } from "#/lib/export";
import {
	type DocContent,
	mutateIndex,
	readDoc,
	readIndex,
	requestPersistentStorage,
	type SaveFailure,
	type SaveResult,
	safeGetItem,
	safeSetItem,
	tidy,
	updateDoc,
	useStoreIndex,
	writeDoc,
	writeLastOpened,
} from "#/lib/store";
import { type Block, layoutBlocks, parseBlocks } from "#/lib/wongoji";

export const Route = createFileRoute("/w/$docId")({ component: Editor });

/** 화면 설정이라 원고와 무관하다. 보관함으로 옮기지 않는다 */
const PANE_KEY = "wongoji:mainPane";

/** 모바일에서 화면 전체를 차지할 쪽 */
type Pane = "write" | "preview";

const PANE_LABEL: Record<Pane, string> = {
	write: "원고",
	preview: "원고지",
};

/** 원고를 읽어 본 결과 */
type Load =
	| { state: "loading" }
	| { state: "ready"; content: Content }
	/** 색인에는 있는데 본문 키가 없다 */
	| { state: "lost" };

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
 * 아주 예전에는 평문으로 저장했으므로 그 경우도 가린다.
 */
function toEditorContent(content: DocContent): Content {
	if (typeof content === "string") return blocksToDoc(parseBlocks(content));
	if (
		content != null &&
		typeof content === "object" &&
		(content as { type?: string }).type === "doc"
	) {
		return content as Content;
	}
	return blocksToDoc([]);
}

function Editor() {
	const { docId } = Route.useParams();
	const navigate = useNavigate();
	const index = useStoreIndex();
	/** 목록에 적힌 지금 원고. 브레드크럼이 놓일 자리를 여기서 읽는다 */
	const opened = index.docs.find((d) => d.id === docId);

	const [load, setLoad] = useState<Load>({ state: "loading" });
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [title, setTitle] = useState("");
	const [goal, setGoal] = useState(0);
	const [mainPane, setMainPane] = useState<Pane>("write");
	// 불러오기로 내용을 갈아끼울 때 에디터를 다시 마운트시키는 열쇠.
	// Tiptap은 만들어진 뒤 content 옵션을 다시 보지 않는다.
	const [editorKey, setEditorKey] = useState(0);
	// 저장이 실패하면 다시 성공할 때까지 화면에 남긴다
	const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
	const saveTimer = useRef<number | undefined>(undefined);
	// 에디터는 쪽을 바꿀 때 다시 마운트된다. 그때 최신 내용으로 되살리려고 붙든다.
	const docRef = useRef<Content | null>(null);
	/*
	 * 실제로 읽어 들인 원고. 주소의 docId보다 한 박자 늦다.
	 *
	 * 주소가 먼저 바뀌고 내용은 effect에서 따라 들어온다. 그 틈에 옛 에디터가
	 * 내용을 알려 오는데, 그것은 옛 원고 것이다. 주소 대신 이 값을 보고 저장한다.
	 */
	const openedRef = useRef("");
	/** 아직 쓰지 않은 저장. 어느 원고 것인지 함께 들고 있다 */
	const pending = useRef<{
		docId: string;
		content: Content;
		blocks: Block[];
	} | null>(null);

	/** 저장 결과를 화면에 반영한다. 하나라도 실패하면 배너가 남는다 */
	const report = useCallback((...results: SaveResult[]) => {
		const failed = results.find((r) => !r.ok);
		setSaveFailure(failed && !failed.ok ? failed : null);
	}, []);

	// localStorage는 브라우저에만 있으므로 마운트 후에 읽는다.
	useEffect(() => {
		const savedPane = safeGetItem(PANE_KEY);
		if (savedPane === "write" || savedPane === "preview")
			setMainPane(savedPane);

		// 기한 지난 휴지통 비우기·끊어진 경로 고치기. 여기로 바로 들어올 수도 있다
		tidy();

		// 용량이 부족할 때 브라우저가 원고를 먼저 지우지 않게 요청한다.
		// 거절되어도 알리지 않는다 — 사용자가 할 수 있는 조치가 없다.
		void requestPersistentStorage();
	}, []);

	/**
	 * 본문과 색인을 함께 저장한다. 어느 원고에 쓸지는 인자로 받는다.
	 *
	 * 제목·목표·분량이 색인에도 있어서 저장이 두 키를 건드린다. 목록을 그릴 때
	 * 문서를 열지 않아도 되도록 치른 값이다. 같은 디바운스로 묶어 한 번에 쓴다.
	 *
	 * 본문은 색인에 넣지 않는다. 색인은 원고를 열고 옮길 때마다 통째로 읽고 쓰는
	 * 것이라, 여기에 본문이 섞이면 원고 수만큼 커진다.
	 */
	const save = useCallback(
		(
			id: string,
			patch: {
				title?: string;
				goal?: number;
				content?: Content;
				blocks?: Block[];
			},
		) => {
			if (!id) return;
			const { content, blocks: counted, ...entry } = patch;

			const results: SaveResult[] = [];
			if (content !== undefined) results.push(writeDoc(id, content));

			// 목록에 보여줄 분량은 본문이 바뀔 때만 다시 잰다
			const stats = counted ? layoutBlocks(counted).stats : undefined;

			results.push(
				mutateIndex((current) =>
					updateDoc(current, id, {
						...entry,
						...(stats && { chars: stats.chars, sheets: stats.sheets }),
					}),
				).result,
			);
			report(...results);
		},
		[report],
	);

	/** 지금 열어 둔 원고에 쓴다 */
	const persist = useCallback(
		(patch: Parameters<typeof save>[1]) => save(openedRef.current, patch),
		[save],
	);

	/**
	 * 기다리고 있는 저장을 지금 끝낸다.
	 *
	 * 밀린 저장은 자기가 어느 원고 것인지 들고 있다. 원고를 바꾸는 도중에 밀어
	 * 넣어도 옆 원고에 쏟아지지 않는다.
	 */
	const flush = useCallback(() => {
		const job = pending.current;
		pending.current = null;
		window.clearTimeout(saveTimer.current);
		saveTimer.current = undefined;
		if (job) save(job.docId, { content: job.content, blocks: job.blocks });
	}, [save]);

	/*
	 * 주소에 있는 원고를 읽는다. 사이드바에서 다른 원고를 고르면 다시 돈다.
	 *
	 * 저장 중인 것이 있으면 먼저 밀어 넣는다. 300ms 디바운스가 아직 안 터진 채로
	 * 원고를 바꾸면 마지막 몇 글자가 사라진다.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: 주소가 바뀔 때만 다시 읽는다
	useEffect(() => {
		flush();

		const entry = readIndex().docs.find((d) => d.id === docId);
		if (!entry) {
			// 없는 원고를 가리키는 주소다. 열 수 있는 곳으로 보낸다
			openedRef.current = "";
			navigate({ to: "/", replace: true });
			return;
		}

		openedRef.current = docId;

		const stored = readDoc(docId);
		setTitle(entry.title);
		setGoal(entry.goal);
		writeLastOpened(docId);

		if (stored == null) {
			/*
			 * 본문 키가 사라졌다. 빈 에디터를 띄우면 그대로 저장되어 마지막 흔적까지
			 * 덮어쓴다. 열지 않고 알린다.
			 */
			docRef.current = null;
			setBlocks([]);
			setLoad({ state: "lost" });
			return;
		}

		const content = toEditorContent(stored);
		docRef.current = content;
		// 에디터를 기다리지 않고 바로 조판한다
		setBlocks(contentToBlocks(content));
		setLoad({ state: "ready", content });
		setEditorKey((k) => k + 1);
	}, [docId, navigate]);

	// 탭을 닫거나 새로고침할 때 마지막 몇 글자를 지킨다
	useEffect(() => {
		window.addEventListener("pagehide", flush);
		return () => {
			window.removeEventListener("pagehide", flush);
			flush();
		};
	}, [flush]);

	const handleChange = useCallback(
		(next: Block[], doc: PMNode) => {
			// 아직 아무 원고도 못 읽었으면 어디에 쓸지 모른다
			if (!openedRef.current) return;

			setBlocks(next);
			const content = doc.toJSON() as Content;
			docRef.current = content;
			pending.current = { docId: openedRef.current, content, blocks: next };

			window.clearTimeout(saveTimer.current);
			saveTimer.current = window.setTimeout(flush, 300);
		},
		[flush],
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
		setBlocks(next.blocks);
		setLoad({ state: "ready", content: doc });
		persist({ title: next.title, content: doc, blocks: next.blocks });
		setEditorKey((k) => k + 1);
	};

	/** 본문을 잃은 원고를 빈 원고로 되살린다 */
	const startBlank = () => {
		const doc = blocksToDoc([]);
		docRef.current = doc;
		setBlocks([]);
		setLoad({ state: "ready", content: doc });
		persist({ content: doc, blocks: [] });
		setEditorKey((k) => k + 1);
	};

	/**
	 * 하나뿐인 원고를 비운다. 버리는 대신이다.
	 *
	 * 저장소만 비우면 안 된다 — 에디터가 옛 내용을 그대로 들고 있어서 다음 타이핑에
	 * 다시 저장된다. 밀린 저장까지 걷어내고 화면을 함께 갈아 끼운다.
	 */
	const resetDoc = (docId: string) => {
		pending.current = null;
		window.clearTimeout(saveTimer.current);
		saveTimer.current = undefined;

		const doc = blocksToDoc([]);
		// 받은 원고에 쓴다. 열어 둔 것이라고 짐작하면 언젠가 엉뚱한 원고를 비운다
		save(docId, { title: "", goal: 0, content: doc, blocks: [] });

		// 화면은 그 원고를 보고 있을 때만 갈아 끼운다
		if (docId !== openedRef.current) return;
		docRef.current = doc;
		setTitle("");
		setGoal(0);
		setBlocks([]);
		setLoad({ state: "ready", content: doc });
		setEditorKey((k) => k + 1);
	};

	/*
	 * 제목은 조판에 넣지 않는다. 원고를 가리키는 이름일 뿐이라 원고지 칸을
	 * 차지해서는 안 되고, 분량에도 세지 않는다.
	 */
	const { pages, stats } = useMemo(() => layoutBlocks(blocks), [blocks]);

	const statsText =
		goal > 0
			? `${stats.sheets} / ${goal}매`
			: `${stats.chars}자 · ${stats.sheets}매`;

	return (
		/*
		 * 화면 높이에 못박는다. min-h로 두면 위쪽 한계가 없어 안쪽 스크롤 영역이
		 * 자기 높이를 정하지 못하고, 원고지가 길어질 때 페이지 전체가 늘어난다.
		 * 정본의 `min-h-svh`를 min-h-0으로 눌러야 그 못이 풀리지 않는다.
		 */
		<Shell
			index={index}
			currentDocId={docId}
			onReport={report}
			onReset={resetDoc}
		>
			<header className="sticky top-0 z-10 border-border border-b bg-background/90 backdrop-blur">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
					{/*
					 * 단추 하나로 족하다. 넓으면 옆의 보관함을 접었다 펴고, 좁으면
					 * 서랍을 연다 — 어느 쪽인지는 Sidebar가 안에서 가른다.
					 */}
					<SidebarTrigger title="보관함" aria-label="보관함" />

					{opened && (
						<Breadcrumb
							index={index}
							path={opened.path}
							leaf={title.trim() || "제목 없는 원고"}
						/>
					)}

					<div className="ml-auto flex items-center gap-3 text-xs tabular-nums">
						<CapacityMeter index={index} />
						<RulesDialog />
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

			{load.state === "lost" ? (
				<LostBody onStartBlank={startBlank} />
			) : (
				<>
					{/* 제목과 분량은 원고·원고지 어느 쪽을 보고 있든 늘 보여야 한다 */}
					<ManuscriptBar
						title={title}
						onTitleChange={changeTitle}
						goal={goal}
						onGoalChange={changeGoal}
						stats={stats}
					/>

					{/*
					 * 넓은 화면에서는 원고와 원고지를 나란히, 좁은 화면에서는 한 쪽만
					 * 보여준다.
					 *
					 * DOM은 한 벌만 두고 CSS로 가린다. 그래야 에디터가 늘 한 번만
					 * 마운트되어 쪽을 오가도 다시 만들어지지 않는다 — undo 히스토리도
					 * 살아남는다.
					 */}
					<main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-6 px-4 pt-4 pb-20 lg:grid-cols-2 lg:pb-6">
						<div
							className={`flex min-h-0 flex-col ${
								mainPane === "write" ? "" : "hidden lg:flex"
							}`}
						>
							{load.state === "ready" && (
								<WongojiEditor
									key={editorKey}
									initialContent={docRef.current ?? load.content}
									onChange={handleChange}
									overlay={
										<span className="flex items-center gap-0.5 rounded bg-background/85 py-0.5 pr-0.5 pl-1.5 text-[0.7rem] text-muted-foreground tabular-nums">
											{statsText}
											<CopyManuscript manuscript={{ title, blocks }} />
										</span>
									}
								/>
							)}
						</div>
						<div
							className={`flex min-h-0 flex-col ${
								mainPane === "preview" ? "" : "hidden lg:flex"
							}`}
						>
							<WongojiPager pages={pages} />
						</div>
					</main>

					{/* 좁은 화면에서만 고른다. 넓은 화면에서는 둘 다 보이니 고를 것이 없다 */}
					<div className="fixed right-4 bottom-4 z-20 flex rounded-full border border-border bg-background px-3 py-2 shadow-lg lg:hidden">
						<PaneToggle mainPane={mainPane} onChoose={choosePane} />
					</div>
				</>
			)}
		</Shell>
	);
}

/**
 * 색인에는 있는데 본문이 없을 때.
 *
 * 빈 에디터를 대신 띄우지 않는다. 그러면 첫 타이핑에 저장이 돌면서 되찾을 여지가
 * 완전히 사라진다. 백업 파일이 있으면 불러오는 편이 낫다.
 */
function LostBody({ onStartBlank }: { onStartBlank: () => void }) {
	return (
		<div className="flex flex-1 items-center justify-center px-6">
			<div className="max-w-md space-y-3 text-center">
				<h2 className="font-semibold text-base">본문을 찾을 수 없습니다</h2>
				<p className="text-muted-foreground text-sm leading-relaxed">
					목록에는 남아 있는데 저장된 본문이 없습니다. 브라우저가 저장 공간을
					비웠거나 다른 탭에서 지웠을 수 있습니다. 백업 파일이 있다면 먼저
					불러오세요.
				</p>
				<Button variant="outline" size="sm" onClick={onStartBlank}>
					빈 원고로 시작
				</Button>
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
