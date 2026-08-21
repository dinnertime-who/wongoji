import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ExportDialog, exportText } from "#/features/export-manuscript";
import { onDocReset } from "#/features/reset-manuscript";
import { useSoloDraft } from "#/features/solo-draft";
import {
	type Pane,
	PaneToggle,
	readPane,
	writePane,
} from "#/features/toggle-pane";
import { Button } from "#/shared/ui/button";
import { GuideFooter } from "#/shared/ui/guide-footer";
import { LandingIntro } from "#/shared/ui/landing-intro";
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
	/**
	 * 로그인 없이 여는 체험 원고인가.
	 *
	 * 세 가지가 여기서 갈린다 — 머리말에 브레드크럼 대신 안내가 오고, 원고지
	 * 아래에 읽을거리가 붙고, **쓰는 자리의 높이를 얻는 방식이 다르다.**
	 */
	const trial = docId === null;
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
	const solo = useSoloDraft(trial);
	const doc = trial ? solo : account;

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
	 * 쓰는 자리가 아직 화면에 있는가.
	 *
	 * 원고·원고지를 고르는 단추가 이것을 보고 숨는다. 체험 원고 쪽은 원고지
	 * 아래로 소개와 사용법이 이어지는 긴 쪽이라, 화면에 못박힌 단추가 읽는 글
	 * 위에 그대로 떠 있게 된다.
	 *
	 * **없으면 그냥 보인다.** IntersectionObserver가 없는 환경(오래된 브라우저,
	 * SSR)에서 `false`로 시작하면 단추가 영영 나타나지 않는다 — 좁은 화면에서
	 * 원고지를 보는 유일한 길이 그것이라 잃을 수 없다.
	 */
	const [onWriting, setOnWriting] = useState(true);

	/*
	 * ref 콜백으로 붙인다. `main`은 본문을 여는 동안·못 열었을 때 그려지지 않아
	 * 나타나고 사라지는데, effect로 붙이면 "언제 나타나는가"를 의존성 배열에
	 * 옮겨 적어야 하고 그 목록은 화면 조건이 늘 때마다 조용히 낡는다. 콜백은
	 * 달릴 때와 떨어질 때 자신이 불린다.
	 */
	const writing = useCallback((el: HTMLElement | null) => {
		if (!el || typeof IntersectionObserver === "undefined") return;

		const watch = new IntersectionObserver(([entry]) =>
			setOnWriting(entry.isIntersecting),
		);
		watch.observe(el);
		return () => {
			watch.disconnect();
			// 붙들 것이 사라졌으면 단추는 도로 보이는 쪽으로 둔다
			setOnWriting(true);
		};
	}, []);

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
				client.invalidateQueries({ queryKey: ARCHIVE_KEY });
				toast("완성본을 고쳐 퇴고로 되돌렸습니다", {
					action: {
						label: "완성 유지",
						onClick: async () => {
							await change({
								kind: "updateDoc",
								id,
								patch: { status: "done" },
							});
						},
					},
				});
			}),
		[docId, client, change],
	);

	/*
	 * 저장이 실패했을 때 배너가 내놓는 "백업 받기".
	 *
	 * 배너는 이 쪽 바깥(레이아웃)에 있어서 원고를 모른다. 지금 원고를 ref로
	 * 붙들고 한 번만 등록한다 — 원고가 바뀔 때마다 다시 등록하면 글자 하나마다
	 * 등록이 돈다.
	 *
	 * **블록이 아니라 문서 원본을 붙든다.** 저장하지 못한 글을 건져 내는 자리라
	 * 여기서 잃는 것이 가장 뼈아프다 — 블록으로 적으면 사람이 띄운 줄이 빠진다.
	 */
	const latest = useRef({ title: doc.title, content });
	latest.current = { title: doc.title, content };
	useEffect(() => {
		registerBackup(() => {
			const now = latest.current;
			// 본문을 아직 앉히지 않았으면 받을 것이 없다
			if (now.content) exportText(now.title, now.content);
		});
		return () => registerBackup(null);
	}, [registerBackup]);

	return (
		<>
			<PageHeader
				sidebar={!trial}
				actions={
					<>
						<RulesDialog />
						<ExportDialog
							manuscript={manuscript}
							content={content}
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
					trial && (
						/*
						 * 체험 원고에는 자리가 없다. 대신 이것이 무엇인지 적는다 —
						 * 여러 편을 쓰려면 로그인해야 한다는 것을 여기서 처음 안다.
						 */
						<span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
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
							(async (next: DocStatus) => {
								await change({
									kind: "updateDoc",
									id: opened.id,
									patch: { status: next },
								});
							})
						}
						onOpenHistory={opened && (() => setHistory(true))}
					/>

					{/*
					 * DOM은 한 벌만 두고 CSS로 가린다. 그래야 에디터가 늘 한 번만
					 * 마운트되어 쪽을 오가도 다시 만들어지지 않는다 — undo 히스토리도
					 * 살아남는다.
					 */}
					{/*
					 * 쓰는 자리의 높이.
					 *
					 * **계정 쪽과 체험 쪽이 높이를 얻는 방식이 다르다.**
					 *
					 * 계정 쪽(`/w/<id>`)은 `AppShell`이 세운 `h-[100dvh]` 기둥 안에
					 * 있어서 `flex-1`이 남는 높이를 그대로 받는다. 체험 쪽(`/`)에는
					 * 그 기둥이 없다 — `_app`을 지나지 않아 머리말·본문·발치가
					 * 그냥 `body`에 얹힌다. 거기서 `flex-1`은 아무 일도 하지 않고,
					 * 격자가 제 높이를 **미리보기 칸에서 빌려 쓰고 있었다.** 넓은
					 * 화면에서는 옆에 선 원고지가 줄을 밀어 열어 주니 멀쩡해 보였는데,
					 * 좁은 화면에서는 그 칸이 `hidden`이라 밀어 줄 것이 없어져
					 * **에디터가 34px로 납작하게 접혔다.** 첫 화면에 글 쓸 자리가
					 * 없었던 것이다.
					 *
					 * 그래서 체험 쪽만 높이를 화면에서 곧바로 떼어 준다. `flex-1`로
					 * 남는 것을 받아 쓸 수 없는 이유가 하나 더 있다 — 아래에 소개와
					 * 사용법이 붙어 쪽이 화면보다 길어지므로, **남는 높이라는 것이
					 * 아예 생기지 않는다.**
					 *
					 * `svh`는 주소창이 나와 있을 때의 높이다. 모바일에서 `dvh`로
					 * 잡으면 스크롤할 때 주소창이 접히며 에디터가 늘었다 줄었다 한다.
					 * `26rem`은 가로로 누운 폰에서도 몇 줄은 보이게 하는 바닥이다.
					 */}
					<main
						ref={writing}
						className={`mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pt-4 pb-20 lg:grid-cols-2 lg:pb-6 ${
							trial ? "min-h-[max(26rem,68svh)]" : "min-h-0"
						}`}
					>
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
											<CopyManuscript title={doc.title} content={content} />
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

					{/*
					 * 좁은 화면에서만 고른다. 넓은 화면에서는 둘 다 보이니 고를 것이 없다.
					 *
					 * **원고지에서 눈을 뗐으면 함께 물러난다.** 체험 원고 쪽은 아래로
					 * 소개와 사용법이 이어지는 긴 쪽인데, 화면에 못박힌 단추는 그 글
					 * 위에 그대로 떠서 읽는 줄을 가린다. 무엇을 고르는 단추인지가
					 * 화면 밖으로 나갔으면 단추도 있을 이유가 없다.
					 */}
					<div
						className={`fixed right-4 bottom-4 z-20 flex rounded-full border border-border bg-background px-3 py-2 shadow-lg transition-opacity lg:hidden ${
							onWriting ? "opacity-100" : "pointer-events-none opacity-0"
						}`}
					>
						<PaneToggle pane={pane} onChoose={choosePane} />
					</div>

					{/*
					 * 읽을거리. **체험 원고 쪽에만 둔다** — 계정 쪽은 색인하지 않고,
					 * 쓰는 동안 띄워 두는 화면에 서비스 소개가 붙어 있을 이유도 없다.
					 *
					 * 소개가 먼저, 사용법 링크가 뒤다. `/`에서 크롤러가 읽을 본문이
					 * 앞의 것이고, 뒤의 것은 거기서 사용법 넷으로 타고 가는 길이다.
					 */}
					{trial && (
						<>
							<LandingIntro />
							<GuideFooter />
						</>
					)}
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
