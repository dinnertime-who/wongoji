import { useEffect, useMemo, useRef, useState } from "react";
import {
	Breadcrumb,
	displayTitle,
	useSaveStatus,
	useStoreIndex,
} from "#/entities/archive";
import {
	goalProgress,
	layoutBlocks,
	type Manuscript,
	RulesDialog,
	WongojiPager,
} from "#/entities/manuscript";
import { CopyManuscript } from "#/features/copy-manuscript";
import { useManuscriptDoc, WongojiEditor } from "#/features/edit-manuscript";
import { ExportDialog, exportBackup } from "#/features/export-manuscript";
import { onDocReset } from "#/features/reset-manuscript";
import {
	type Pane,
	PaneToggle,
	readPane,
	writePane,
} from "#/features/toggle-pane";
import { Button } from "#/shared/ui/button";
import { ManuscriptBar } from "#/widgets/manuscript-bar";
import { PageHeader } from "#/widgets/page-header";

/**
 * 원고를 쓰는 쪽.
 *
 * 넓은 화면에서는 원고와 원고지를 나란히, 좁은 화면에서는 한 쪽만 보여준다.
 */
export function EditorPage({ docId }: { docId: string }) {
	const index = useStoreIndex();
	const { registerBackup } = useSaveStatus();
	const doc = useManuscriptDoc(docId);

	/** 목록에 적힌 지금 원고. 브레드크럼이 놓일 자리를 여기서 읽는다 */
	const opened = index.docs.find((d) => d.id === docId);

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
	const { pages, stats } = useMemo(
		() => layoutBlocks(doc.blocks),
		[doc.blocks],
	);

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

	const latest = useRef(manuscript);
	latest.current = manuscript;
	useEffect(() => {
		registerBackup(() => exportBackup(latest.current));
		return () => registerBackup(null);
	}, [registerBackup]);

	return (
		<>
			<PageHeader
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
				{opened && (
					<Breadcrumb
						path={opened.path}
						leaf={displayTitle({ title: doc.title })}
					/>
				)}
			</PageHeader>

			{doc.load.state === "lost" ? (
				<LostBody onStartBlank={doc.startBlank} />
			) : (
				<>
					{/* 제목과 분량은 원고·원고지 어느 쪽을 보고 있든 늘 보여야 한다 */}
					<ManuscriptBar
						title={doc.title}
						onTitleChange={doc.changeTitle}
						goal={doc.goal}
						onGoalChange={doc.changeGoal}
						stats={stats}
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
							<WongojiPager pages={pages} />
						</div>
					</main>

					{/* 좁은 화면에서만 고른다. 넓은 화면에서는 둘 다 보이니 고를 것이 없다 */}
					<div className="fixed right-4 bottom-4 z-20 flex rounded-full border border-border bg-background px-3 py-2 shadow-lg lg:hidden">
						<PaneToggle pane={pane} onChoose={choosePane} />
					</div>
				</>
			)}
		</>
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
