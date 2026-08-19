import { useNavigate } from "@tanstack/react-router";
import { FilePlusIcon, FolderPlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import {
	ancestorIds,
	type DocEntry,
	displayTitle,
	type FolderEntry,
	fullPath,
	type Path,
	ROOT,
	type StoreIndex,
	useArchive,
	useArchiveMutation,
	useSaveStatus,
} from "#/entities/archive";
import { type Created, useCreateEntry } from "#/features/create-entry";
import { DownloadArchive, useArchiveDownload } from "#/features/export-archive";
import { TrashDialog } from "#/features/manage-trash";
import { FolderPicker } from "#/features/move-entry";
import { useResetDoc } from "#/features/reset-manuscript";
import { Button } from "#/shared/ui/button";
import { ConfirmDialog } from "#/shared/ui/confirm-dialog";
import { NameDialog } from "#/shared/ui/name-dialog";
import {
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	useSidebar,
} from "#/shared/ui/sidebar";
import { useOpenedEntry } from "../model/use-opened-entry";
import { type Picked, useSelection } from "../model/use-selection";
import { ManuscriptTree, type TreeActions } from "./ManuscriptTree";

/**
 * 고른 것이 놓인 자리. 새 원고와 새 폴더가 여기 생긴다.
 *
 * 폴더는 그 **안**이고 원고는 그 **옆**이다. 폴더를 열어 놓고 새 원고를 누르는
 * 사람은 거기에 만들려는 것이고, 원고를 보다 누르는 사람은 그 원고와 나란히
 * 두려는 것이다.
 *
 * 고른 것이 사라졌으면 맨 위로 돌린다 — 다른 기기에서 버린 폴더가 그렇다.
 */
function pathOf(index: StoreIndex, picked: Picked): Path {
	if (picked.kind === "root") return ROOT;
	if (picked.kind === "folder") {
		const folder = index.folders.find((f) => f.id === picked.id);
		return folder ? fullPath(folder) : ROOT;
	}
	return index.docs.find((d) => d.id === picked.id)?.path ?? ROOT;
}

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
 * 새 원고와 새 폴더는 **지금 보고 있는 원고가 든 폴더**에 만든다. 어디에 생겼는지
 * 헤매지 않게 하려는 것이다. 맨 위에 만들려면 트리의 **빈 곳을 누른다** — 끌어
 * 놓기가 이미 "빈 곳 = 맨 위"로 읽히므로 누르는 쪽도 같게 두었다.
 *
 * 무엇이 열려 있는지 색인이 무엇인지 저장이 실패했는지를 전부 제가 읽는다.
 * 물려받으면 이 위의 모든 부품이 그것을 아는 척해야 하고, 틀(AppShell)이 쪽마다
 * 다시 마운트되는 원인이기도 했다.
 */
export function ManuscriptSidebar() {
	const navigate = useNavigate();
	const { index } = useArchive();
	// 버린 것이 지금 보고 있는 것인지 가리는 데 쓴다. 강조는 `selection`이 정한다
	const { docId: currentDocId } = useOpenedEntry();
	const { report } = useSaveStatus();
	const change = useArchiveMutation();
	const { createDocIn, duplicateDocById, createFolderIn } = useCreateEntry();
	const resetDoc = useResetDoc();
	/*
	 * 발치의 "전체 받기"는 제 안에서 따로 든다. 저기는 제 단추에 진행을 그리고
	 * 여기는 토스트를 빌리므로, 둘이 한 상태를 나눠 쓰면 폴더를 받는 동안 발치의
	 * 단추가 "전체 받기 3/12"라고 거짓말을 한다.
	 */
	const { downloadFolder, downloadDoc } = useArchiveDownload();
	const { isMobile, setOpenMobile } = useSidebar();
	const [sheet, setSheet] = useState<Sheet>(CLOSED);

	/*
	 * 무엇을 골라 두었는가. 주소에서 시작해 제 상태로 든다(`useSelection`).
	 *
	 * 새 원고와 새 폴더는 여기 생긴다. 폴더를 골랐으면 그 안이고, 원고를
	 * 골랐으면 그 원고 옆이며, 아무것도 안 골랐으면 맨 위다.
	 */
	const selection = useSelection();
	const here = pathOf(index, selection.picked);

	/**
	 * 원고를 고르면 서랍을 닫는다.
	 *
	 * 서랍일 때만이다. 옆에 펴 둔 보관함은 원고를 골라도 그대로 둔다 — 자리를
	 * 차지하지 않으므로 닫을 이유가 없고, 이어서 다른 원고를 고를 수도 있다.
	 */
	const closeDrawer = () => {
		if (isMobile) setOpenMobile(false);
	};

	/** 새로 만들거나 복제한 원고를 연다. 실패는 배너가 받는다 */
	/*
	 * 만들어지기를 기다렸다가 연다. 본문이 IndexedDB로 가면서 만드는 일이
	 * 비동기가 되었다 — 기다리지 않고 옮기면 본문이 아직 없는 원고를 연다.
	 */
	const open = async (creating: Promise<Created>) => {
		const { docId, result } = await creating;
		report(result);
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
		 * `placeEntry`도 제 안에서 한 번 더 막는다.
		 */
		drop: (moving, to) => void change({ kind: "placeEntry", moving, to }),
		nudge: (moving, dir) => void change({ kind: "nudgeEntry", moving, dir }),

		duplicateDoc: (doc) => open(duplicateDocById(doc.id)),

		/*
		 * 받는 일은 색인을 건드리지 않는다. `change`를 지나지 않고 기능이 곧장
		 * 하는 이유다 — 알릴 것(진행·못 담은 것)도 저장 배너가 아니라 토스트다.
		 */
		downloadFolder,
		downloadDoc,

		/*
		 * 버릴 때 확인을 받지 않는다. 30일 동안 휴지통에 있으므로 되돌릴 수 있고,
		 * 되돌릴 수 있는 일에 확인을 받으면 확인 자체가 값싸진다. 완전히 삭제하는 것은
		 * 휴지통 안에서만 할 수 있고, 거기서는 묻는다.
		 */
		trashDoc: (doc) => {
			change({ kind: "trashDoc", id: doc.id });
			// 보고 있던 원고를 버렸으면 열어 둘 수 없다
			if (doc.id === currentDocId) navigate({ to: "/", replace: true });
		},

		resetDoc: (doc) => setSheet({ kind: "resetDoc", doc }),

		trashFolder: (folder) => {
			change({ kind: "trashFolder", id: folder.id });
			const gone = ancestorIds(
				index.docs.find((d) => d.id === currentDocId)?.path ?? ROOT,
			).includes(folder.id);
			if (gone) navigate({ to: "/", replace: true });
		},
	};

	return (
		<>
			<SidebarHeader className="flex-row items-center gap-1 py-2 pr-2 pl-2">
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
			 * 세로로만 스크롤한다. 가로로도 밀던 시절이 있었는데, 폭이 못박혀 있어
			 * 긴 이름을 보여 줄 다른 길이 없었기 때문이다. 이제는 경계를 끌어
			 * 넓힐 수 있으므로 이름은 자르고 가로 스크롤은 걷었다.
			 */}
			<SidebarContent className="px-1">
				{/* 트리가 짧아도 아래 빈 곳까지 늘어나야 한다. 거기가 root로 꺼내는 자리다 */}
				<nav aria-label="원고 보관함" className="flex flex-1 flex-col">
					<ManuscriptTree
						actions={actions}
						onNavigate={closeDrawer}
						selection={selection}
					/>
				</nav>
			</SidebarContent>

			<SidebarFooter className="border-border border-t px-1 py-1">
				{/*
				 * 보관함을 통째로 받는 자리. 휴지통과 나란히 둔다 — 둘 다 원고
				 * 하나가 아니라 보관함 전체를 다루는 일이라 발치가 제자리다.
				 */}
				<DownloadArchive />
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
				onConfirm={(name) => void createFolderIn(name, here)}
			/>

			<NameDialog
				open={sheet.kind === "renameFolder"}
				onOpenChange={(open) => !open && setSheet(CLOSED)}
				title="폴더 이름 바꾸기"
				initial={sheet.kind === "renameFolder" ? sheet.folder.name : ""}
				confirmLabel="바꾸기"
				onConfirm={async (name) => {
					if (sheet.kind !== "renameFolder") return;
					const { id } = sheet.folder;
					await change({ kind: "renameFolder", id, name });
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
				onPick={async (path) => {
					// 골라서 옮기면 그 폴더 맨 끝으로 간다. 자리까지 고르게 하지 않는다
					const moving =
						sheet.kind === "moveFolder"
							? ({ kind: "folder", id: sheet.folder.id } as const)
							: sheet.kind === "moveDoc"
								? ({ kind: "doc", id: sheet.doc.id } as const)
								: null;
					if (!moving) return;
					await change({
						kind: "placeEntry",
						moving,
						to: { path, before: null },
					});
				}}
			/>

			<TrashDialog
				open={sheet.kind === "trash"}
				onOpenChange={(open) => !open && setSheet(CLOSED)}
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
				onConfirm={async () => {
					if (sheet.kind === "resetDoc") {
						report(await resetDoc(sheet.doc.id));
					}
				}}
			/>
		</>
	);
}
