import { useNavigate } from "@tanstack/react-router";
import { FilePlusIcon, FolderPlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { FolderPicker } from "#/components/FolderPicker";
import { ManuscriptTree, type TreeActions } from "#/components/ManuscriptTree";
import { NameDialog } from "#/components/NameDialog";
import { TrashDialog } from "#/components/TrashDialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import {
	ancestorIds,
	createDoc,
	createFolder,
	type DocEntry,
	displayTitle,
	duplicateDoc,
	type FolderEntry,
	moveDoc,
	moveFolder,
	mutateIndex,
	type Path,
	ROOT,
	readDoc,
	renameFolder,
	type SaveResult,
	type StoreIndex,
	trashDoc,
	trashFolder,
	writeDoc,
} from "#/lib/store";

/** 어떤 창을 열어 두었는가. 한 번에 하나만 뜬다 */
type Sheet =
	| { kind: "none" }
	| { kind: "newFolder" }
	| { kind: "renameFolder"; folder: FolderEntry }
	| { kind: "moveFolder"; folder: FolderEntry }
	| { kind: "moveDoc"; doc: DocEntry }
	| { kind: "resetDoc" }
	| { kind: "trash" };

const CLOSED: Sheet = { kind: "none" };

/** 새 원고의 빈 본문. 키가 아예 없으면 "본문을 잃었다"는 뜻이 된다 */
const EMPTY_BODY = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * 원고 보관함.
 *
 * 새 원고와 새 폴더는 **지금 보고 있는 원고가 든 폴더**에 만든다. 맨 위에 있으면
 * root에 만든다. 어디에 생겼는지 헤매지 않게 하려는 것이다.
 */
export function ManuscriptSidebar({
	index,
	currentDocId,
	onReport,
	onReset,
	onNavigate,
	inDrawer = false,
}: {
	index: StoreIndex;
	currentDocId: string;
	onReport: (result: SaveResult) => void;
	/**
	 * 지금 열어 둔 원고를 비운다.
	 *
	 * 저장소만 고쳐서는 안 된다 — 에디터가 들고 있는 내용은 그대로 남아 곧바로
	 * 다시 저장된다. 화면을 쥔 쪽이 함께 처리해야 한다.
	 */
	onReset: () => void;
	onNavigate?: () => void;
	/** 좁은 화면의 서랍 안인가. 서랍은 오른쪽 위에 제 닫기 단추를 그린다 */
	inDrawer?: boolean;
}) {
	const navigate = useNavigate();
	const [sheet, setSheet] = useState<Sheet>(CLOSED);
	const here = index.docs.find((d) => d.id === currentDocId)?.path ?? ROOT;

	/** 색인을 고치고 결과를 알린다. 성공했는지 돌려준다 */
	const change = (edit: (index: StoreIndex) => StoreIndex): boolean => {
		const { result } = mutateIndex(edit);
		onReport(result);
		return result.ok;
	};

	const addDoc = (path: Path) => {
		let createdId = "";
		const ok = change((current) => {
			const made = createDoc(current, { path });
			createdId = made.doc.id;
			return made.index;
		});
		if (!ok) return;

		writeDoc(createdId, EMPTY_BODY);
		navigate({ to: "/w/$docId", params: { docId: createdId } });
		onNavigate?.();
	};

	const actions: TreeActions = {
		addDoc,

		renameFolder: (folder) => setSheet({ kind: "renameFolder", folder }),
		moveFolder: (folder) => setSheet({ kind: "moveFolder", folder }),
		moveDoc: (doc) => setSheet({ kind: "moveDoc", doc }),

		duplicateDoc: (doc) => {
			// 본문을 먼저 읽는다. 색인만 늘려 놓고 본문을 못 읽으면 빈 사본이 남는다
			const body = readDoc(doc.id);
			let copyId = "";
			const ok = change((current) => {
				const made = duplicateDoc(current, doc.id);
				if (!made) return current;
				copyId = made.doc.id;
				return made.index;
			});
			if (!ok || !copyId) return;

			onReport(writeDoc(copyId, body ?? EMPTY_BODY));
			navigate({ to: "/w/$docId", params: { docId: copyId } });
			onNavigate?.();
		},

		/*
		 * 버릴 때 확인을 받지 않는다. 30일 동안 휴지통에 있으므로 되돌릴 수 있고,
		 * 되돌릴 수 있는 일에 확인을 받으면 확인 자체가 값싸진다. 영영 지우는 것은
		 * 휴지통 안에서만 할 수 있고, 거기서는 묻는다.
		 */
		trashDoc: (doc) => {
			change((current) => trashDoc(current, doc.id));
			// 보고 있던 원고를 버렸으면 열어 둘 수 없다
			if (doc.id === currentDocId) navigate({ to: "/", replace: true });
		},

		resetDoc: () => setSheet({ kind: "resetDoc" }),

		trashFolder: (folder) => {
			change((current) => trashFolder(current, folder.id));
			const gone = ancestorIds(
				index.docs.find((d) => d.id === currentDocId)?.path ?? ROOT,
			).includes(folder.id);
			if (gone) navigate({ to: "/", replace: true });
		},
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* 서랍의 닫기 X가 오른쪽 위에 겹쳐 앉는다. 그만큼 비켜 준다 */}
			<div
				className={`flex shrink-0 items-center gap-1 py-2 pl-2 ${
					inDrawer ? "pr-12" : "pr-2"
				}`}
			>
				<span className="flex-1 px-1 text-muted-foreground text-xs">원고</span>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setSheet({ kind: "newFolder" })}
					title="새 폴더"
					aria-label="새 폴더"
				>
					<FolderPlusIcon />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => addDoc(here)}
					title="새 원고"
					aria-label="새 원고"
				>
					<FilePlusIcon />
				</Button>
			</div>

			{/*
			 * 가로·세로 모두 스크롤한다. 원고가 쌓이면 세로가, 트리가 깊어지면 가로가
			 * 필요하다. 이름을 자르는 것보다 미는 편이 낫다.
			 */}
			<nav
				className="min-h-0 flex-1 overflow-auto px-1"
				aria-label="원고 보관함"
			>
				<ManuscriptTree
					index={index}
					currentDocId={currentDocId}
					actions={actions}
					onNavigate={onNavigate}
				/>
			</nav>

			<div className="shrink-0 border-border border-t px-1 py-1">
				<Button
					variant="ghost"
					size="sm"
					className="w-full justify-start text-muted-foreground"
					onClick={() => setSheet({ kind: "trash" })}
				>
					<Trash2Icon />
					휴지통
					{index.trash.length > 0 && (
						<span className="ml-auto tabular-nums">{index.trash.length}</span>
					)}
				</Button>
			</div>

			<NameDialog
				open={sheet.kind === "newFolder"}
				onOpenChange={(open) => !open && setSheet(CLOSED)}
				title="새 폴더"
				description="지금 보고 있는 원고와 같은 자리에 만듭니다."
				initial="새 폴더"
				onConfirm={(name) =>
					change((current) => createFolder(current, name, here).index)
				}
			/>

			<NameDialog
				open={sheet.kind === "renameFolder"}
				onOpenChange={(open) => !open && setSheet(CLOSED)}
				title="폴더 이름 바꾸기"
				initial={sheet.kind === "renameFolder" ? sheet.folder.name : ""}
				confirmLabel="바꾸기"
				onConfirm={(name) => {
					if (sheet.kind !== "renameFolder") return;
					const { id } = sheet.folder;
					change((current) => renameFolder(current, id, name));
				}}
			/>

			<FolderPicker
				open={sheet.kind === "moveFolder" || sheet.kind === "moveDoc"}
				onOpenChange={(open) => !open && setSheet(CLOSED)}
				index={index}
				title={
					sheet.kind === "moveFolder"
						? `'${sheet.folder.name}' 이동`
						: sheet.kind === "moveDoc"
							? `'${displayTitle(sheet.doc)}' 이동`
							: "이동"
				}
				movingFolderId={
					sheet.kind === "moveFolder" ? sheet.folder.id : undefined
				}
				currentPath={
					sheet.kind === "moveFolder"
						? sheet.folder.path
						: sheet.kind === "moveDoc"
							? sheet.doc.path
							: ROOT
				}
				onPick={(path) => {
					if (sheet.kind === "moveFolder") {
						const { id } = sheet.folder;
						change((current) => moveFolder(current, id, path));
					} else if (sheet.kind === "moveDoc") {
						const { id } = sheet.doc;
						change((current) => moveDoc(current, id, path));
					}
				}}
			/>

			<TrashDialog
				open={sheet.kind === "trash"}
				onOpenChange={(open) => !open && setSheet(CLOSED)}
				index={index}
				onReport={onReport}
			/>

			{/*
			 * 초기화는 휴지통을 거치지 않는다. 되돌릴 수 없으므로 묻는다 —
			 * 버리기와 달리 물어야 하는 쪽이다.
			 */}
			<AlertDialog
				open={sheet.kind === "resetDoc"}
				onOpenChange={(open) => !open && setSheet(CLOSED)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>이 원고를 비울까요?</AlertDialogTitle>
						<AlertDialogDescription>
							하나뿐인 원고라 버릴 수 없습니다. 본문과 제목, 분량 목표를 지우고
							빈 원고로 되돌립니다. 되돌릴 수 없으니 남길 것이 있다면 먼저
							내보내세요.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>취소</AlertDialogCancel>
						<AlertDialogAction
							onClick={onReset}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							비우기
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

/** 헤더에 놓는 현재 위치. 사이드바를 접었을 때 유일한 단서다 */
export function ManuscriptBreadcrumb({
	index,
	docId,
}: {
	index: StoreIndex;
	docId: string;
}) {
	const doc = index.docs.find((d) => d.id === docId);
	if (!doc) return null;

	const byId = new Map(index.folders.map((f) => [f.id, f]));
	const names = ancestorIds(doc.path)
		.map((id) => byId.get(id)?.name)
		.filter((name): name is string => Boolean(name));

	// 길어지면 앞을 줄인다
	const shown = names.length > 2 ? ["…", ...names.slice(-2)] : names;

	return (
		<span className="min-w-0 truncate text-muted-foreground text-xs">
			{shown.map((name) => (
				<span key={name}>{name} / </span>
			))}
			<span className="text-foreground">
				{doc.title.trim() || "제목 없는 원고"}
			</span>
		</span>
	);
}
