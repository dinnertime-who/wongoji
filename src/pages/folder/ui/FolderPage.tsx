import { Link, useNavigate } from "@tanstack/react-router";
import { FileTextIcon, FolderIcon } from "lucide-react";
import { useEffect } from "react";
import {
	Breadcrumb,
	childrenOf,
	type DocEntry,
	displayTitle,
	type FolderEntry,
	fullPath,
	type Moving,
	type Path,
	type Placement,
	placeEntry,
	useArchive,
	useArchiveMutation,
	useSaveStatus,
} from "#/entities/archive";
import { useCreateEntry } from "#/features/create-entry";
import {
	DropLine,
	type DropRow,
	type DropZone,
	type EntryDnd,
	NO_CALLOUT,
	placementFor,
	useEntryDnd,
} from "#/features/reorder-entry";
import { Button } from "#/shared/ui/button";
import { PageTitle } from "#/shared/ui/page-title";
import { PageHeader } from "#/widgets/page-header";

/**
 * 폴더 안을 펼쳐 보이는 쪽.
 *
 * 보관함의 트리와 같은 것을 담지만 쓰임이 다르다. 트리는 원고를 쓰는 동안 옆에
 * 두고 곁눈질하는 것이고, 이 쪽은 무엇이 들어 있는지 한 번에 보려고 여는 것이다.
 */
export function FolderPage({ folderId }: { folderId: string }) {
	const navigate = useNavigate();
	const { index, isPending } = useArchive();
	const { report } = useSaveStatus();
	const change = useArchiveMutation();
	const { createDocIn, createFolderIn } = useCreateEntry();

	const folder = index.folders.find((f) => f.id === folderId);

	/*
	 * 없는 폴더를 가리키는 주소면 열 수 있는 곳으로 보낸다. 휴지통에 넣었거나
	 * 다른 창에서 지운 것이다.
	 *
	 * **목록을 아직 못 받았으면 판단하지 않는다.** 첫 그림에서는 무엇을 찾아도
	 * 없다고 나오는데, 그대로 믿으면 멀쩡한 폴더를 열 때마다 되돌려 보낸다.
	 *
	 * index를 의존값에 두어 보고 있는 폴더가 사라지는 것도 잡는다.
	 */
	useEffect(() => {
		if (isPending) return;
		if (!index.folders.some((f) => f.id === folderId)) {
			navigate({ to: "/", replace: true });
		}
	}, [folderId, index, isPending, navigate]);

	if (!folder) return null;

	const inside = fullPath(folder);
	const { folders, docs } = childrenOf(index, inside);

	const rename = (name: string) =>
		void change({ kind: "renameFolder", id: folder.id, name });

	const addDoc = async () => {
		const { docId, result } = await createDocIn(inside);
		report(result);
		// 만들지 못했으면 옮기지 않는다. 없는 원고로 보내면 곧바로 되돌아온다
		if (docId) navigate({ to: "/w/$docId", params: { docId } });
	};

	const addFolder = () => void createFolderIn("새 폴더", inside);

	return (
		<>
			<PageHeader width="narrow">
				<Breadcrumb path={folder.path} leaf={folder.name} />
			</PageHeader>

			<div className="mx-auto w-full max-w-3xl overflow-auto px-6 py-10">
				<PageTitle
					value={folder.name}
					onChange={rename}
					placeholder="이름 없는 폴더"
					label="폴더 이름"
				/>

				<EntryList inside={inside} folders={folders} docs={docs} />

				<div className="mt-4 flex gap-2">
					<Button variant="outline" size="sm" onClick={addDoc}>
						새 원고
					</Button>
					<Button variant="outline" size="sm" onClick={addFolder}>
						새 폴더
					</Button>
				</div>
			</div>
		</>
	);
}

/**
 * 이 폴더에 든 것들. 트리와 같은 손짓으로 차례를 바꿀 수 있다.
 *
 * 부품을 따로 뗀 것은 훅 때문이다. 위에서는 없는 폴더를 만나면 곧바로
 * 돌아 나가는데, 그 뒤에 훅을 부를 수는 없다.
 *
 * **사이드바의 트리와는 별개의 끌기다.** 둘이 한 화면에 있어도 창을 건너
 * 끌지 못한다 — 그 까닭은 `useEntryDnd`에 적어 두었다.
 */
function EntryList({
	inside,
	folders,
	docs,
}: {
	inside: Path;
	folders: FolderEntry[];
	docs: DocEntry[];
}) {
	const { index } = useArchive();
	const change = useArchiveMutation();

	/*
	 * 이 목록의 빈 곳은 **이 폴더 안 맨 끝**이다. 트리에서는 같은 자리가
	 * root였는데, 거기가 폴더 밖으로 꺼내는 유일한 길이었기 때문이다. 여기서는
	 * 이미 폴더 안을 들여다보는 중이라 밖으로 꺼내는 자리가 아니다.
	 */
	const aimed = (to: { row: DropRow; zone: DropZone } | null): Placement =>
		to === null
			? { path: inside, before: null }
			: placementFor(index, to.row, to.zone);

	const dnd = useEntryDnd({
		canDrop: (moving, to) => placeEntry(index, moving, aimed(to)) !== index,
		onDrop: (moving, to) =>
			void change({ kind: "placeEntry", moving, to: aimed(to) }),
	});

	const empty = folders.length === 0 && docs.length === 0;

	return (
		<div
			className={`mt-6 flex min-h-24 flex-col rounded-md ${NO_CALLOUT} ${
				dnd.isOverRoot ? "bg-accent/60" : ""
			}`}
			{...dnd.rootProps}
		>
			{folders.map((child) => (
				<EntryRow key={child.id} dnd={dnd} path={inside} folder={child} />
			))}
			{docs.map((doc) => (
				<EntryRow key={doc.id} dnd={dnd} path={inside} doc={doc} />
			))}

			{empty && (
				<p className="py-3 text-muted-foreground text-sm">
					아직 비어 있습니다.
				</p>
			)}
		</div>
	);
}

/**
 * 안에 든 것 하나. 폴더면 그 폴더 쪽으로, 원고면 원고로 간다.
 *
 * 분량은 원고에만 적는다. 폴더의 분량을 더해 보여 주려면 아래를 모두 훑어야
 * 하는데, 목록을 그릴 때마다 치를 값은 아니다.
 *
 * 트리와 달리 한 층뿐이라 들여쓰기가 없다. 표시선도 늘 왼쪽 끝에서 시작한다.
 */
function EntryRow({
	dnd,
	path,
	folder,
	doc,
}: {
	dnd: EntryDnd;
	/** 이 목록이 놓인 자리 */
	path: Path;
	folder?: FolderEntry;
	doc?: DocEntry;
}) {
	const entry: (DropRow & { label: string; moving: Moving }) | null = folder
		? {
				kind: "folder",
				id: folder.id,
				path,
				label: folder.name,
				moving: { kind: "folder", id: folder.id },
			}
		: doc
			? {
					kind: "doc",
					id: doc.id,
					path,
					label: displayTitle(doc),
					moving: { kind: "doc", id: doc.id },
				}
			: null;
	if (!entry) return null;

	const zone = dnd.zoneOn(entry.id);

	return (
		<div
			className={`relative flex items-center rounded-md ${
				zone === "into" ? "bg-accent ring-1 ring-ring" : ""
			} ${dnd.isDragging(entry.id) ? "opacity-40" : ""}`}
			{...dnd.dragProps(entry.moving, entry.label)}
			{...dnd.dropProps(entry)}
		>
			{(zone === "before" || zone === "after") && (
				<DropLine zone={zone} indent="0px" />
			)}
			{folder ? (
				<Link
					to="/f/$folderId"
					params={{ folderId: folder.id }}
					className="flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-base hover:bg-muted"
				>
					<FolderIcon className="size-4 shrink-0 text-muted-foreground" />
					<span className="truncate">{folder.name}</span>
				</Link>
			) : (
				doc && (
					<Link
						to="/w/$docId"
						params={{ docId: doc.id }}
						className="flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-base hover:bg-muted"
					>
						<FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate">{displayTitle(doc)}</span>
						<span className="ml-auto shrink-0 text-muted-foreground text-xs tabular-nums">
							{doc.sheets}매
						</span>
					</Link>
				)
			)}
		</div>
	);
}
