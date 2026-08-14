import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	ARCHIVE_KEY,
	Breadcrumb,
	type DocStatus,
	displayTitle,
	useArchive,
	useArchiveMutation,
	useSaveStatus,
} from "#/entities/archive";
import {
	blockIndexAt,
	goalProgress,
	layoutBlocks,
	type Manuscript,
	onDocDemoted,
	RulesDialog,
	WongojiPager,
} from "#/entities/manuscript";
import { CopyManuscript } from "#/features/copy-manuscript";
import { HistoryDialog, onDocRestored } from "#/features/doc-history";
import { useManuscriptDoc, WongojiEditor } from "#/features/edit-manuscript";
import { ExportDialog, exportBackup } from "#/features/export-manuscript";
import { onDocReset } from "#/features/reset-manuscript";
import { useSoloDraft } from "#/features/solo-draft";
import {
	type Pane,
	PaneToggle,
	readPane,
	writePane,
} from "#/features/toggle-pane";
import { Button } from "#/shared/ui/button";
import { ManuscriptBar } from "#/widgets/manuscript-bar";
import { PageHeader } from "#/widgets/page-header";

/** 커서가 이만큼 멎으면 미리보기를 그 장으로 옮긴다 */
const CARET_PAUSE = 600;

/**
 * 원고를 쓰는 쪽.
 *
 * 넓은 화면에서는 원고와 원고지를 나란히, 좁은 화면에서는 한 쪽만 보여준다.
 *
 * **원고 하나를 쓰는 일은 로그인 여부와 상관이 없다.** 저장하는 곳만 다르다 —
 * 계정 원고는 서버로, 체험 원고는 이 브라우저로. 그 차이를 훅 두 벌이 감추고
 * 같은 모양(`ManuscriptEditing`)을 내놓으므로 이 쪽은 한 벌이면 된다.
 */
export function EditorPage({ docId }: { docId: string | null }) {
	const { index } = useArchive();
	const { registerBackup } = useSaveStatus();
	const change = useArchiveMutation();
	const client = useQueryClient();
	const [history, setHistory] = useState(false);

	/*
	 * 둘 다 부른다. 훅은 조건부로 부를 수 없어서다. 쓰이지 않는 쪽은 스스로
	 * 아무 일도 하지 않는다 — 계정 쪽은 빈 id를, 체험 쪽은 꺼짐을 받는다.
	 */
	const account = useManuscriptDoc(docId ?? "");
	const solo = useSoloDraft(docId === null);
	const doc = docId === null ? solo : account;

	/** 목록에 적힌 지금 원고. 브레드크럼이 놓일 자리를 여기서 읽는다 */
	const opened = docId ? index.docs.find((d) => d.id === docId) : undefined;

	const [pane, setPane] = useState<Pane>("write");

	// localStorage는 브라우저에만 있으므로 마운트 후에 읽는다
	useEffect(() => {
		const saved = readPane();
		if (saved) setPane(saved);
	}, []);

	const choosePane = (next: Pane) => {
		setPane(next);
		writePane(next);
	};

	/*
	 * 제목은 조판에 넣지 않는다. 원고를 가리키는 이름일 뿐이라 원고지 칸을
	 * 차지해서는 안 되고, 분량에도 세지 않는다.
	 */
	const { pages, stats, blockPages } = useMemo(
		() => layoutBlocks(doc.blocks),
		[doc.blocks],
	);

	/*
	 * 커서가 멎으면 미리보기를 그 장으로 한 번 옮긴다.
	 *
	 * **따라다니지 않는다.** 원고지는 결과물이 아니라 "규칙대로 쓰이고 있다"를
	 * 확인하는 창이라(docs/contest-features.md), 커서마다 끌려다니면 도움이
	 * 아니라 시선을 뺏는 일이 된다. 다만 70매짜리 원고에서 43매째를 고치는데
	 * 미리보기가 1장에 멈춰 있으면 그 창은 장식이 되므로, 손이 멎은 그때 한 번만
	 * 맞춘다.
	 *
	 * 타이핑 중에는 타이머가 계속 새로 걸린다 — 그것이 곧 "멎었을 때"다.
	 */
	const [caretNode, setCaretNode] = useState(-1);
	const [focusPage, setFocusPage] = useState<number | undefined>(undefined);
	const content = doc.content;

	useEffect(() => {
		if (caretNode < 0 || !content || blockPages.length === 0) return;

		const timer = window.setTimeout(() => {
			const block = blockIndexAt(content, caretNode);
			setFocusPage(blockPages[Math.min(block, blockPages.length - 1)]);
		}, CARET_PAUSE);
		return () => window.clearTimeout(timer);
	}, [caretNode, content, blockPages]);

	const manuscript: Manuscript = { title: doc.title, blocks: doc.blocks };

	/*
	 * 저장이 실패했을 때 배너가 내놓는 "백업 받기".
	 *
	 * 배너는 이 쪽 바깥(레이아웃)에 있어서 원고를 모른다. 지금 원고를 ref로
	 * 붙들고 한 번만 등록한다 — 원고가 바뀔 때마다 다시 등록하면 글자 하나마다
	 * 등록이 돈다.
	 */
	/*
	 * 보관함에서 이 원고를 비우면 화면도 갈아 끼운다.
	 *
	 * 비우는 쪽과 쓰는 쪽이 둘 다 피처라 서로 부를 수 없다. 둘을 아는 이 쪽이
	 * 이어 준다 — 레이어를 가로지르지 않고 붙이는 자리가 여기다.
	 */
	useEffect(() => onDocReset(doc.clearToBlank), [doc.clearToBlank]);

	/*
	 * 이력에서 되돌리면 서버의 본문이 갈린다. 에디터는 이미 앉힌 원고를 다시
	 * 앉히지 않으므로, 알려 주지 않으면 화면에 옛 글이 그대로 남는다.
	 */
	const reload = doc.reload;
	useEffect(
		() => onDocRestored((id) => id === docId && reload()),
		[docId, reload],
	);

	/*
	 * 완성본을 고치면 서버가 퇴고로 내린다. 조용히 하되 알린다 — 뱃지가 바뀌는
	 * 것만으로는 놓칠 수 있고, 되돌릴 길을 함께 주면 "내가 원한 게 아닌데"가
	 * 한 번에 풀린다.
	 */
	useEffect(
		() =>
			onDocDemoted((id) => {
				if (id !== docId) return;
				void client.invalidateQueries({ queryKey: ARCHIVE_KEY });
				toast("완성본을 고쳐 퇴고로 되돌렸습니다", {
					action: {
						label: "완성 유지",
						onClick: () =>
							void change({
								kind: "updateDoc",
								id,
								patch: { status: "done" },
							}),
					},
				});
			}),
		[docId, client, change],
	);

	const latest = useRef(manuscript);
	latest.current = manuscript;
	useEffect(() => {
		registerBackup(() => exportBackup(latest.current));
		return () => registerBackup(null);
	}, [registerBackup]);

	return (
		<>
			<PageHeader
				sidebar={docId !== null}
				actions={
					<>
						<RulesDialog />
						<ExportDialog
							manuscript={manuscript}
							onImport={(next) => doc.replace(next.title, next.blocks)}
						/>
					</>
				}
			>
				{opened ? (
					<Breadcrumb
						path={opened.path}
						leaf={displayTitle({ title: doc.title })}
					/>
				) : (
					docId === null && (
						/*
						 * 체험 원고에는 자리가 없다. 대신 이것이 무엇인지 적는다 —
						 * 여러 편을 쓰려면 로그인해야 한다는 것을 여기서 처음 안다.
						 */
						<span className="min-w-0 truncate text-muted-foreground text-xs">
							로그인 없이 쓰는 원고 한 편 · 여러 편과 폴더는 로그인 후에
						</span>
					)
				)}
			</PageHeader>

			{doc.load.state === "lost" || doc.load.state === "unreachable" ? (
				<Trouble state={doc.load.state} onStartBlank={doc.startBlank} />
			) : (
				<>
					{/* 제목과 분량은 원고·원고지 어느 쪽을 보고 있든 늘 보여야 한다 */}
					<ManuscriptBar
						title={doc.title}
						onTitleChange={doc.changeTitle}
						goal={doc.goal}
						onGoalChange={doc.changeGoal}
						stats={stats}
						/*
						 * 상태와 이력은 보관함에 든 원고의 것이다. 체험 원고는 한 편뿐이라
						 * 진행을 표시할 것도, 되돌릴 이력도 없다.
						 */
						status={opened?.status}
						onStatusChange={
							opened &&
							((next: DocStatus) =>
								void change({
									kind: "updateDoc",
									id: opened.id,
									patch: { status: next },
								}))
						}
						onOpenHistory={opened && (() => setHistory(true))}
					/>

					{/*
					 * DOM은 한 벌만 두고 CSS로 가린다. 그래야 에디터가 늘 한 번만
					 * 마운트되어 쪽을 오가도 다시 만들어지지 않는다 — undo 히스토리도
					 * 살아남는다.
					 */}
					<main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-6 px-4 pt-4 pb-20 lg:grid-cols-2 lg:pb-6">
						<div
							className={`flex min-h-0 flex-col ${
								pane === "write" ? "" : "hidden lg:flex"
							}`}
						>
							{doc.load.state === "ready" && (
								<WongojiEditor
									key={doc.editorKey}
									initialContent={doc.content ?? doc.load.content}
									onChange={doc.changeBody}
									onCaret={setCaretNode}
									overlay={
										<span className="flex items-center gap-0.5 rounded bg-background/85 py-0.5 pr-0.5 pl-1.5 text-[0.7rem] text-muted-foreground tabular-nums">
											{/* 목표가 없으면 글자 수까지 적는다 — 원고 위라 자리가 있다 */}
											{goalProgress(stats.sheets, doc.goal) ??
												`${stats.chars}자 · ${stats.sheets}매`}
											<CopyManuscript manuscript={manuscript} />
										</span>
									}
								/>
							)}
						</div>
						<div
							className={`flex min-h-0 flex-col ${
								pane === "preview" ? "" : "hidden lg:flex"
							}`}
						>
							<WongojiPager pages={pages} focusPage={focusPage} />
						</div>
					</main>

					{/* 좁은 화면에서만 고른다. 넓은 화면에서는 둘 다 보이니 고를 것이 없다 */}
					<div className="fixed right-4 bottom-4 z-20 flex rounded-full border border-border bg-background px-3 py-2 shadow-lg lg:hidden">
						<PaneToggle pane={pane} onChoose={choosePane} />
					</div>
				</>
			)}

			{opened && (
				<HistoryDialog
					docId={opened.id}
					open={history}
					onOpenChange={setHistory}
				/>
			)}
		</>
	);
}

/**
 * 본문을 열지 못했을 때.
 *
 * **두 경우를 반드시 가른다.** 서버에 본문이 없는 것과 서버에 닿지 못한 것은
 * 화면에 같은 말을 써서는 안 된다 — 앞쪽에만 "빈 원고로 시작"이 있고, 그것을
 * 연결이 끊겼을 뿐인 원고에 대고 누르면 멀쩡한 글을 빈 것으로 덮는다.
 *
 * 어느 쪽이든 빈 에디터를 대신 띄우지 않는다. 그러면 첫 타이핑에 저장이 돌면서
 * 되찾을 여지가 완전히 사라진다.
 */
function Trouble({
	state,
	onStartBlank,
}: {
	state: "lost" | "unreachable";
	onStartBlank: () => void;
}) {
	if (state === "unreachable") {
		return (
			<div className="flex flex-1 items-center justify-center px-6">
				<div className="max-w-md space-y-3 text-center">
					<h2 className="font-semibold text-base">
						본문을 불러오지 못했습니다
					</h2>
					<p className="text-muted-foreground text-sm leading-relaxed">
						계정 보관함에 닿지 못했습니다. 원고는 그대로 있습니다 — 연결을
						확인하고 새로고침해 주세요.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 items-center justify-center px-6">
			<div className="max-w-md space-y-3 text-center">
				<h2 className="font-semibold text-base">본문을 찾을 수 없습니다</h2>
				<p className="text-muted-foreground text-sm leading-relaxed">
					목록에는 남아 있는데 저장된 본문이 없습니다. 다른 기기에서 지웠거나
					올리지 못한 원고일 수 있습니다. 백업 파일이 있다면 먼저 불러오세요.
				</p>
				<Button variant="outline" size="sm" onClick={onStartBlank}>
					빈 원고로 시작
				</Button>
			</div>
		</div>
	);
}
