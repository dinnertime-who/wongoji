import { useNavigate } from "@tanstack/react-router";
import { FilePlusIcon, FolderPlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { FolderPicker } from "#/components/FolderPicker";
import { ManuscriptTree, type TreeActions } from "#/components/ManuscriptTree";
import { TrashDialog } from "#/components/TrashDialog";
import {
	ancestorIds,
	type Created,
	createDocIn,
	createFolder,
	type DocEntry,
	displayTitle,
	duplicateDocById,
	type FolderEntry,
	fullPath,
	moveDoc,
	moveFolder,
	mutateIndex,
	type Path,
	ROOT,
	renameFolder,
	type SaveResult,
	type StoreIndex,
	trashDoc,
	trashFolder,
} from "#/lib/store";
import { Button } from "#/shared/ui/button";
import { ConfirmDialog } from "#/shared/ui/confirm-dialog";
import { NameDialog } from "#/shared/ui/name-dialog";
import {
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	useSidebar,
} from "#/shared/ui/sidebar";

/** 어떤 창을 열어 두었는가. 한 번에 하나만 뜬다 */
type Sheet =
	| { kind: "none" }
	| { kind: "newFolder" }
	| { kind: "renameFolder"; folder: FolderEntry }
	| { kind: "moveFolder"; folder: FolderEntry }
	| { kind: "moveDoc"; doc: DocEntry }
	| { kind: "resetDoc"; doc: DocEntry }
	| { kind: "trash" };

const CLOSED: Sheet = { kind: "none" };

/**
 * 원고 보관함.
 *
 * 새 원고와 새 폴더는 **지금 보고 있는 원고가 든 폴더**에 만든다. 맨 위에 있으면
 * root에 만든다. 어디에 생겼는지 헤매지 않게 하려는 것이다.
 */
export function ManuscriptSidebar({
	index,
	currentDocId,
	currentFolderId,
	onReport,
	onReset,
}: {
	index: StoreIndex;
	currentDocId: string;
	/** 지금 열어 둔 폴더. 원고 쪽에는 없다 */
	currentFolderId?: string;
	onReport: (result: SaveResult) => void;
	/**
	 * 그 원고를 비운다.
	 *
	 * 저장소만 고쳐서는 안 된다 — 에디터가 들고 있는 내용은 그대로 남아 곧바로
	 * 다시 저장된다. 화면을 쥔 쪽이 함께 처리해야 한다.
	 */
	onReset: (docId: string) => void;
}) {
	const navigate = useNavigate();
	const { isMobile, setOpenMobile } = useSidebar();
	const [sheet, setSheet] = useState<Sheet>(CLOSED);
	/*
	 * 새 원고와 새 폴더가 놓일 자리.
	 *
	 * 폴더를 열어 두었으면 그 안이다. 열어 놓고 새 원고를 누르는 사람은 거기에
	 * 만들려는 것이지, 원고 쪽에서 마지막으로 보던 자리에 만들려는 것이 아니다.
	 */
	const openedFolder = index.folders.find((f) => f.id === currentFolderId);
	const here = openedFolder
		? fullPath(openedFolder)
		: (index.docs.find((d) => d.id === currentDocId)?.path ?? ROOT);

	/**
	 * 원고를 고르면 서랍을 닫는다.
	 *
	 * 서랍일 때만이다. 옆에 펴 둔 보관함은 원고를 골라도 그대로 둔다 — 자리를
	 * 차지하지 않으므로 닫을 이유가 없고, 이어서 다른 원고를 고를 수도 있다.
	 */
	const closeDrawer = () => {
		if (isMobile) setOpenMobile(false);
	};

	/** 색인을 고치고 결과를 알린다. 성공했는지 돌려준다 */
	const change = (edit: (index: StoreIndex) => StoreIndex): boolean => {
		const { result } = mutateIndex(edit);
		onReport(result);
		return result.ok;
	};

	/** 새로 만들거나 복제한 원고를 연다. 실패는 배너가 받는다 */
	const open = ({ docId, result }: Created) => {
		onReport(result);
		if (!docId) return;
		navigate({ to: "/w/$docId", params: { docId } });
		closeDrawer();
	};

	const addDoc = (path: Path) => open(createDocIn(path));

	const actions: TreeActions = {
		addDoc,

		renameFolder: (folder) => setSheet({ kind: "renameFolder", folder }),
		moveFolder: (folder) => setSheet({ kind: "moveFolder", folder }),
		moveDoc: (doc) => setSheet({ kind: "moveDoc", doc }),

		/*
		 * 끌어다 놓은 이동. 갈 곳이 이미 정해져 있어 다이얼로그를 열지 않는다.
		 *
		 * 갈 수 없는 자리는 트리가 미리 걸러 놓으므로 여기서 다시 묻지 않는다.
		 * moveFolder도 제 안에서 한 번 더 막는다.
		 */
		dropDoc: (docId, to) => change((current) => moveDoc(current, docId, to)),
		dropFolder: (folderId, to) =>
			change((current) => moveFolder(current, folderId, to)),

		duplicateDoc: (doc) => open(duplicateDocById(doc.id)),

		/*
		 * 버릴 때 확인을 받지 않는다. 30일 동안 휴지통에 있으므로 되돌릴 수 있고,
		 * 되돌릴 수 있는 일에 확인을 받으면 확인 자체가 값싸진다. 완전히 삭제하는 것은
		 * 휴지통 안에서만 할 수 있고, 거기서는 묻는다.
		 */
		trashDoc: (doc) => {
			change((current) => trashDoc(current, doc.id));
			// 보고 있던 원고를 버렸으면 열어 둘 수 없다
			if (doc.id === currentDocId) navigate({ to: "/", replace: true });
		},

		resetDoc: (doc) => setSheet({ kind: "resetDoc", doc }),

		trashFolder: (folder) => {
			change((current) => trashFolder(current, folder.id));
			const gone = ancestorIds(
				index.docs.find((d) => d.id === currentDocId)?.path ?? ROOT,
			).includes(folder.id);
			if (gone) navigate({ to: "/", replace: true });
		},
	};

	return (
		<>
			<SidebarHeader className="flex-row items-center gap-1 py-2 pl-2 pr-2">
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
			</SidebarHeader>

			{/*
			 * 가로·세로 모두 스크롤한다. 원고가 쌓이면 세로가, 트리가 깊어지면 가로가
			 * 필요하다. 이름을 자르는 것보다 미는 편이 낫다.
			 */}
			<SidebarContent
				// 정본은 가로 넘침을 숨긴다. 트리는 밀어내야 하므로 되돌린다
				className="overflow-x-auto px-1"
			>
				{/* 트리가 짧아도 아래 빈 곳까지 늘어나야 한다. 거기가 root로 꺼내는 자리다 */}
				<nav aria-label="원고 보관함" className="flex flex-1 flex-col">
					<ManuscriptTree
						index={index}
						currentDocId={currentDocId}
						currentFolderId={currentFolderId}
						actions={actions}
						onNavigate={closeDrawer}
					/>
				</nav>
			</SidebarContent>

			<SidebarFooter className="border-border border-t px-1 py-1">
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
			</SidebarFooter>

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
			<ConfirmDialog
				open={sheet.kind === "resetDoc"}
				onOpenChange={(open) => !open && setSheet(CLOSED)}
				title="이 원고를 비울까요?"
				description="하나뿐인 원고라 버릴 수 없습니다. 본문과 제목, 분량 목표를 지우고 빈 원고로 되돌립니다. 되돌릴 수 없으니 남길 것이 있다면 먼저 내보내세요."
				confirmLabel="비우기"
				onConfirm={() => sheet.kind === "resetDoc" && onReset(sheet.doc.id)}
			/>
		</>
	);
}
