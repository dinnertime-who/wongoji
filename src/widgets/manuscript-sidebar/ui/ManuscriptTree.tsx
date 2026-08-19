import { Link } from "@tanstack/react-router";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	CopyIcon,
	DownloadIcon,
	FileTextIcon,
	FolderIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
	RotateCcwIcon,
	Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	ancestorIds,
	childrenOf,
	type DocEntry,
	displayTitle,
	type FolderEntry,
	fullPath,
	isUnder,
	type Moving,
	type Path,
	type Placement,
	placeEntry,
	ROOT,
	StatusIcon,
	type StoreIndex,
	statusOf,
	useArchive,
} from "#/entities/archive";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/shared/ui/dropdown-menu";
import { useOpenedEntry } from "../model/use-opened-entry";
import type { Selection } from "../model/use-selection";

/** 트리에서 걸 수 있는 일들. 실제 처리는 사이드바가 한다 */
export interface TreeActions {
	addDoc: (path: Path) => void;
	renameFolder: (folder: FolderEntry) => void;
	moveFolder: (folder: FolderEntry) => void;
	trashFolder: (folder: FolderEntry) => void;
	moveDoc: (doc: DocEntry) => void;
	duplicateDoc: (doc: DocEntry) => void;
	trashDoc: (doc: DocEntry) => void;
	/** 그 폴더 아래를 zip 하나로 받는다 */
	downloadFolder: (folder: FolderEntry) => void;
	/** 원고 한 편을 평문 하나로 받는다. zip으로 싸지 않는다 */
	downloadDoc: (doc: DocEntry) => void;
	/** 하나뿐인 원고를 비운다. 버리는 대신이다 */
	resetDoc: (doc: DocEntry) => void;
	/*
	 * 끌어다 놓아 옮긴다. 다이얼로그를 거치는 이동과 목적지는 같지만 고르는
	 * 방법이 달라 따로 둔다 — 이쪽은 갈 곳이 이미 정해져 있다.
	 */
	drop: (moving: Moving, to: Placement) => void;
	/** 형제 사이에서 한 칸 민다. 끌지 않고 차례를 바꾸는 길이다 */
	nudge: (moving: Moving, dir: -1 | 1) => void;
}

/** 줄의 들여쓰기. 깊이가 깊어질수록 오른쪽으로 민다 */
const indentAt = (depth: number) => `${depth * 0.75 + 0.5}rem`;

/**
 * 놓기 표시. 안으로 들어가는 것은 줄 전체에, 끼우는 것은 사이의 선에.
 *
 * 두 표시가 서로 다른 것은 뜻이 다르기 때문이다 — 줄이 통째로 밝아지면 그
 * 폴더 **안**이고, 선이 그어지면 그 자리에 **낀다.**
 */
function dropClass(dnd: EntryDnd, id: string): string {
	return dnd.zoneOn(id) === "into" ? "bg-accent ring-1 ring-ring" : "";
}

/**
 * 지금 열어 둔 줄.
 *
 * 밝기만 달리하던 것을 색조까지 바꿨다 — 사이드바 바탕(`#f0eee7`)과
 * `--muted`(`#ebe8e0`)는 2%밖에 차이가 나지 않아서, 칠해 두어도 어느 줄이
 * 열려 있는지 보이지 않았다. 왼쪽에 격자색 띠를 세워 한 번 더 못 박는다.
 */
const SELECTED =
	"bg-grid/15 font-medium before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-grid";

/** 끼울 자리면 선을, 아니면 아무것도 */
function dropLine(dnd: EntryDnd, id: string, depth: number) {
	const zone = dnd.zoneOn(id);
	if (zone !== "before" && zone !== "after") return null;
	return <DropLine zone={zone} indent={indentAt(depth)} />;
}

/**
 * 폴더 트리.
 *
 * root는 폴더로 그리지 않는다 — 그 안의 것들이 맨 위에 온다.
 *
 * **이름은 줄임표로 자른다.** 전에는 자르지 않고 가로로 밀었다 — 폭이 `16rem`에
 * 못박혀 있었으므로 긴 이름을 보여 줄 다른 길이 없었기 때문이다. 이제는 경계를
 * 끌어 폭을 넓힐 수 있으니(`features/resize-sidebar`) 미는 쪽이 할 일이 없어졌고,
 * 가로 스크롤은 세로로 훑는 목록에서 늘 방해가 된다.
 */
export function ManuscriptTree({
	actions,
	onNavigate,
	selection,
}: {
	actions: TreeActions;
	/** 원고를 골랐을 때. 좁은 화면에서 서랍을 닫는 데 쓴다 */
	onNavigate?: () => void;
	/** 무엇을 골라 두었는가. 강조도 새로 만들 자리도 이것 하나에서 나온다 */
	selection: Selection;
}) {
	const { index } = useArchive();
	/*
	 * 강조는 `selection`이 정하지만, **어디를 펴 둘지는 주소가 정한다.** 골라 둔
	 * 것을 지웠다고 열어 둔 원고까지 가는 길이 접히면, 보고 있는 글이 트리에서
	 * 사라진다.
	 */
	const { docId: currentDocId, folderId: currentFolderId } = useOpenedEntry();
	// 지금 원고까지 가는 길은 펴 둔다
	const current = index.docs.find((d) => d.id === currentDocId);
	const [open, setOpen] = useState<Set<string>>(
		() => new Set(current ? ancestorIds(current.path) : []),
	);
	/*
	 * 보고 있는 것까지 가는 길은 열어 둔다. 처음 그릴 때뿐 아니라 옮겨 다닐 때마다
	 * 따라 연다 — 폴더 쪽에서 안쪽 폴더로 들어가면 트리에서도 그 자리가 보여야 한다.
	 *
	 * 이미 다 열려 있으면 그대로 돌려준다. 새 Set을 만들면 색인이 바뀔 때마다
	 * 한 번씩 더 그린다.
	 */
	useEffect(() => {
		const path = currentFolderId
			? index.folders.find((f) => f.id === currentFolderId)?.path
			: index.docs.find((d) => d.id === currentDocId)?.path;
		if (path === undefined) return;

		const trail = ancestorIds(path);
		setOpen((prev) =>
			trail.every((id) => prev.has(id)) ? prev : new Set([...prev, ...trail]),
		);
	}, [currentDocId, currentFolderId, index]);

	const toggle = (id: string) =>
		setOpen((prev) => {
			const next = new Set(prev);
			if (!next.delete(id)) next.add(id);
			return next;
		});

	/*
	 * 놓을 자리를 색인의 자리로 옮긴다. 빈 곳이면 root 맨 끝이다.
	 *
	 * 폴더가 제 자손 안으로 가는 것도 여기서 걸러지지 않는다 — `placeEntry`가
	 * 그것을 막고 색인을 그대로 돌려주므로, 아래 `canDrop`이 "달라진 것이
	 * 없다"로 읽는다.
	 */
	const aimed = (to: { row: DropRow; zone: DropZone } | null): Placement =>
		to === null
			? { path: ROOT, before: null }
			: placementFor(index, to.row, to.zone);

	const dnd = useEntryDnd({
		/*
		 * 놓아 보고 색인이 그대로면 놓을 것이 없다.
		 *
		 * 제자리에 놓는 것, 제 자손 안으로 넣는 것, 이미 그 폴더에 있는 것 —
		 * 갈 수 없는 경우를 여기서 하나씩 세지 않는다. **무엇이 제자리인지 아는
		 * 것은 `placeEntry`고, 두 벌로 두면 언젠가 갈린다.**
		 */
		canDrop: (moving, to) => placeEntry(index, moving, aimed(to)) !== index,
		onDrop: (moving, to) => actions.drop(moving, aimed(to)),
	});

	return (
		/*
		 * 빈 곳에 놓으면 root로 나온다. 폴더 밖으로 꺼낼 다른 길이 없다.
		 *
		 * 트리가 짧으면 빈 곳도 좁으므로 아래로 넉넉히 늘린다.
		 */
		<div
			// 줄끼리 붙여 두면 어느 것을 눌렀는지 손가락이 헷갈린다
			className={`flex min-w-0 flex-1 flex-col gap-1 py-1 ${NO_CALLOUT} ${
				dnd.isOverRoot ? "bg-accent/60" : ""
			}`}
			{...dnd.rootProps}
		>
			<Level
				index={index}
				path={ROOT}
				depth={0}
				open={open}
				onToggle={toggle}
				selection={selection}
				actions={{
					...actions,
					addDoc: (path) => {
						// 만들자마자 그 안이 보여야 한다
						setOpen((prev) => new Set(prev).add(path.split("/").at(-2) ?? ""));
						actions.addDoc(path);
					},
				}}
				onNavigate={onNavigate}
				dnd={dnd}
			/>

			{/*
			 * 빈 곳 = 맨 위.
			 *
			 * 끌어 놓기가 이미 그렇게 읽힌다 — 여기에 떨어뜨리면 폴더 밖으로
			 * 나온다. 누르는 쪽도 같은 뜻이 되게 맞춘다.
			 *
			 * **누르면 골라 둔 줄의 강조가 꺼진다.** 값이 하나뿐이라 그렇게 될 수밖에
			 * 없고, 그래서 여기 깔리는 색이 "선택이 이리로 왔다"로 읽힌다. 줄과 빈
			 * 곳이 같은 색으로 함께 켜지던 시절에는 그 색이 거짓말이었다.
			 *
			 * `div`에 onClick을 얹지 않고 진짜 단추를 둔다 — 키보드로도 닿아야
			 * 하고, 눌린 것이 줄인지 빈 곳인지 target을 견주어 가려낼 필요도 없다.
			 *
			 * 글씨는 두지 않는다. 조용해야 할 자리라 안내문이 박히면 못생기고,
			 * 이름은 화면에 안 보여도 있어야 한다 — 눈으로 색을 볼 수 없는
			 * 사람에게는 그것이 이 단추의 전부다.
			 */}
			<button
				type="button"
				onClick={selection.clear}
				aria-label="맨 위 고르기"
				aria-pressed={selection.picked.kind === "root"}
				className={`mt-auto min-h-10 flex-1 rounded ${
					selection.picked.kind === "root" ? "bg-grid/15" : "hover:bg-muted/60"
				}`}
			/>
		</div>
	);
}

function Level({
	index,
	path,
	depth,
	open,
	onToggle,
	selection,
	actions,
	onNavigate,
	dnd,
}: {
	index: StoreIndex;
	path: Path;
	depth: number;
	open: Set<string>;
	onToggle: (id: string) => void;
	selection: Selection;
	actions: TreeActions;
	onNavigate?: () => void;
	dnd: EntryDnd;
}) {
	const { folders, docs } = childrenOf(index, path);
	// 깊이를 패딩으로 준다. 깊어질수록 이름에 남는 자리가 줄고, 거기서 잘린다
	const indent = { paddingLeft: indentAt(depth) };

	/*
	 * 마지막 하나는 버릴 수 없다.
	 *
	 * 원고가 없는 화면이 있을 수 없어 버리자마자 빈 원고가 새로 생긴다. 그러면
	 * 목록에 그대로 "제목 없는 원고"가 남아 아무 일도 없었던 것처럼 보인다.
	 * 버리는 시늉 대신 초기화라고 적고 실제로 비운다.
	 */
	const onlyOne = index.docs.length === 1;

	return (
		<>
			{folders.map((folder, i) => {
				const expanded = open.has(folder.id);
				const inside = fullPath(folder);
				const dragging = dnd.isDragging(folder.id);
				return (
					// 폴더 줄과 그 안의 것들 사이도 바깥과 같은 간격으로 벌린다
					<div key={folder.id} className="flex flex-col gap-1">
						{/* 폴더는 제 안쪽을 받는다. 끌고 있는 그 폴더 자신은 흐리게 둔다 */}
						<div
							className={`group relative flex items-center rounded ${
								selection.has("folder", folder.id) ? SELECTED : ""
							} ${dropClass(dnd, folder.id)} ${NO_CALLOUT} ${
								dragging ? "opacity-40" : ""
							}`}
							{...dnd.dragProps({ kind: "folder", id: folder.id }, folder.name)}
							{...dnd.dropProps({ kind: "folder", id: folder.id, path })}
						>
							{dropLine(dnd, folder.id, depth)}
							{/*
							 * 펴고 접는 일과 열어 보는 일을 나눈다. 셰브론은 여기 목록을
							 * 늘였다 줄이고, 이름은 그 폴더 쪽으로 간다.
							 */}
							<button
								type="button"
								onClick={() => onToggle(folder.id)}
								style={indent}
								className="shrink-0 rounded py-1 pr-0.5 hover:bg-muted"
								title={expanded ? "접기" : "펼치기"}
								aria-label={`${folder.name} ${expanded ? "접기" : "펼치기"}`}
								aria-expanded={expanded}
							>
								{expanded ? (
									<ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
								) : (
									<ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
								)}
							</button>
							<Link
								to="/f/$folderId"
								params={{ folderId: folder.id }}
								onClick={() => {
									selection.pick("folder", folder.id);
									onNavigate?.();
								}}
								className="flex min-w-0 flex-1 items-center gap-1 rounded py-1 pr-2 text-left text-sm hover:bg-muted"
							>
								<FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
								<span className="truncate">{folder.name}</span>
							</Link>

							{/*
							 * +가 없으면 갓 만든 폴더에 원고를 넣을 길이 없다 — 머리말의
							 * 새 원고는 지금 보고 있는 원고 옆에 만든다.
							 */}
							<div className="flex shrink-0 items-center">
								<RowButton
									label={`${folder.name}에 새 원고`}
									onClick={() => actions.addDoc(fullPath(folder))}
								>
									<PlusIcon />
								</RowButton>
								<RowMenu label={`${folder.name} 메뉴`}>
									<DropdownMenuItem
										onSelect={() => actions.renameFolder(folder)}
									>
										<PencilIcon />
										이름 바꾸기
									</DropdownMenuItem>
									{/*
									 * 빈 폴더에서는 흐리게 둔다. 눌러 봐야 "받을 원고가
									 * 없습니다"를 듣는 일이고, 그 말은 누르기 전에 보이는
									 * 편이 낫다. 휴지통에 든 것은 세지 않는다 — zip에도
									 * 담지 않으므로 그것을 세면 빈 zip이 나온다.
									 */}
									<DropdownMenuItem
										disabled={!index.docs.some((d) => isUnder(d.path, inside))}
										onSelect={() => actions.downloadFolder(folder)}
									>
										<DownloadIcon />
										받기
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<NudgeItems
										moving={{ kind: "folder", id: folder.id }}
										first={i === 0}
										last={i === folders.length - 1}
										onNudge={actions.nudge}
									/>
									<DropdownMenuItem onSelect={() => actions.moveFolder(folder)}>
										<FolderIcon />
										이동
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										variant="destructive"
										onSelect={() => actions.trashFolder(folder)}
									>
										<Trash2Icon />
										휴지통으로
									</DropdownMenuItem>
								</RowMenu>
							</div>
						</div>

						{expanded && (
							<Level
								index={index}
								path={inside}
								depth={depth + 1}
								open={open}
								onToggle={onToggle}
								selection={selection}
								actions={actions}
								onNavigate={onNavigate}
								dnd={dnd}
							/>
						)}
					</div>
				);
			})}

			{docs.map((doc, i) => (
				/*
				 * 원고 줄도 놓는 자리를 받는다. 제가 놓인 폴더를 목적지로 넘기므로,
				 * 원고 사이에 떨어뜨려도 그 폴더로 들어간다. 촘촘한 목록에서 폴더 줄만
				 * 노려 맞히지 않아도 된다.
				 */
				<div
					key={doc.id}
					className={`group relative flex items-center rounded ${
						selection.has("doc", doc.id) ? SELECTED : "hover:bg-muted"
					} ${dropClass(dnd, doc.id)} ${dnd.isDragging(doc.id) ? "opacity-40" : ""} ${NO_CALLOUT}`}
					{...dnd.dragProps({ kind: "doc", id: doc.id }, displayTitle(doc))}
					{...dnd.dropProps({ kind: "doc", id: doc.id, path })}
				>
					{dropLine(dnd, doc.id, depth)}
					<Link
						to="/w/$docId"
						params={{ docId: doc.id }}
						onClick={() => {
							selection.pick("doc", doc.id);
							onNavigate?.();
						}}
						style={{ paddingLeft: `${depth * 0.75 + 1.6}rem` }}
						className="flex min-w-0 flex-1 items-center gap-1 py-1 pr-2 text-sm"
					>
						<FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
						<span className="truncate">{displayTitle(doc)}</span>
						{/*
						 * 앞은 무엇인가(원고), 뒤는 어디까지 왔는가(상태). 글씨였다면
						 * 이 줄에 들어올 자리가 없었지만 아이콘은 제목이 잘리는 만큼만
						 * 가져간다.
						 */}
						<StatusIcon
							status={statusOf(doc.status)}
							className="ml-auto size-3.5"
						/>
					</Link>

					<div className="flex shrink-0 items-center">
						<RowMenu label={`${displayTitle(doc)} 메뉴`}>
							<DropdownMenuItem onSelect={() => actions.duplicateDoc(doc)}>
								<CopyIcon />
								복제
							</DropdownMenuItem>
							{/* 복제는 여기에 한 벌 더, 받기는 밖으로 한 벌. 짝이라 나란히 둔다 */}
							<DropdownMenuItem onSelect={() => actions.downloadDoc(doc)}>
								<DownloadIcon />
								받기
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<NudgeItems
								moving={{ kind: "doc", id: doc.id }}
								first={i === 0}
								last={i === docs.length - 1}
								onNudge={actions.nudge}
							/>
							<DropdownMenuItem onSelect={() => actions.moveDoc(doc)}>
								<FolderIcon />
								이동
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							{onlyOne ? (
								<DropdownMenuItem
									variant="destructive"
									onSelect={() => actions.resetDoc(doc)}
								>
									<RotateCcwIcon />
									초기화
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem
									variant="destructive"
									onSelect={() => actions.trashDoc(doc)}
								>
									<Trash2Icon />
									휴지통으로
								</DropdownMenuItem>
							)}
						</RowMenu>
					</div>
				</div>
			))}
		</>
	);
}

/**
 * 차례를 한 칸씩 미는 메뉴 항목.
 *
 * **끌어 놓기만 두면 키보드로는 차례를 바꿀 길이 없다.** 이 메뉴에 이미 이동이
 * 들어 있는 것과 같은 짝이다 — 끌기로 할 수 있는 일에는 늘 메뉴 쪽 길이 있다.
 *
 * 양 끝에서는 흐리게 둔다. 눌러도 아무 일이 없는 것보다, 여기가 끝이라고
 * 보여 주는 편이 낫다.
 */
function NudgeItems({
	moving,
	first,
	last,
	onNudge,
}: {
	moving: Moving;
	first: boolean;
	last: boolean;
	onNudge: (moving: Moving, dir: -1 | 1) => void;
}) {
	return (
		<>
			<DropdownMenuItem disabled={first} onSelect={() => onNudge(moving, -1)}>
				<ArrowUpIcon />
				위로
			</DropdownMenuItem>
			<DropdownMenuItem disabled={last} onSelect={() => onNudge(moving, 1)}>
				<ArrowDownIcon />
				아래로
			</DropdownMenuItem>
		</>
	);
}

/**
 * 줄에 붙는 단추가 드러나는 조건.
 *
 * 넓은 화면에서는 그 줄에 마우스를 올려야 보인다 — 목록이 단추로 뒤덮이면 제목이
 * 안 읽힌다. 좁은 화면에서는 늘 보인다. 손가락에는 hover가 없어서, 숨겨 두면
 * 이동도 복제도 삭제도 닿을 길이 없다.
 */
const REVEAL =
	"opacity-100 lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover:opacity-100 lg:data-open:opacity-100";

/** 줄 위에 겹쳐 두는 단추 */
function RowButton({
	label,
	onClick,
	children,
}: {
	label: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Button
			variant="ghost"
			size="icon-xs"
			className={REVEAL}
			onClick={onClick}
			title={label}
			aria-label={label}
		>
			{children}
		</Button>
	);
}

/**
 * 줄마다 붙는 ⋯ 메뉴.
 *
 * 메뉴가 열려 있는 동안에는 마우스가 떠나도 단추가 남아 있어야 한다. 사라지면
 * 메뉴만 허공에 뜬 꼴이 된다.
 */
function RowMenu({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-xs"
					className={REVEAL}
					title={label}
					aria-label={label}
				>
					<MoreHorizontalIcon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
