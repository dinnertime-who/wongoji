import { Link } from "@tanstack/react-router";
import {
	ChevronDownIcon,
	ChevronRightIcon,
	CopyIcon,
	FileTextIcon,
	FolderIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
	RotateCcwIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	ancestorIds,
	childrenOf,
	type DocEntry,
	displayTitle,
	type FolderEntry,
	fullPath,
	type Path,
	ROOT,
	type StoreIndex,
} from "#/lib/store";

/** 트리에서 걸 수 있는 일들. 실제 처리는 사이드바가 한다 */
export interface TreeActions {
	addDoc: (path: Path) => void;
	renameFolder: (folder: FolderEntry) => void;
	moveFolder: (folder: FolderEntry) => void;
	trashFolder: (folder: FolderEntry) => void;
	moveDoc: (doc: DocEntry) => void;
	duplicateDoc: (doc: DocEntry) => void;
	trashDoc: (doc: DocEntry) => void;
	/** 하나뿐인 원고를 비운다. 버리는 대신이다 */
	resetDoc: (doc: DocEntry) => void;
}

/**
 * 폴더 트리.
 *
 * root는 폴더로 그리지 않는다 — 그 안의 것들이 맨 위에 온다.
 * 이름은 줄임표로 자르지 않고 가로로 넘긴다. 트리가 깊어지면 미는 편이 낫다.
 */
export function ManuscriptTree({
	index,
	currentDocId,
	actions,
	onNavigate,
}: {
	index: StoreIndex;
	currentDocId: string;
	actions: TreeActions;
	/** 원고를 골랐을 때. 좁은 화면에서 서랍을 닫는 데 쓴다 */
	onNavigate?: () => void;
}) {
	// 지금 원고까지 가는 길은 펴 둔다
	const current = index.docs.find((d) => d.id === currentDocId);
	const [open, setOpen] = useState<Set<string>>(
		() => new Set(current ? ancestorIds(current.path) : []),
	);

	const toggle = (id: string) =>
		setOpen((prev) => {
			const next = new Set(prev);
			if (!next.delete(id)) next.add(id);
			return next;
		});

	return (
		<div className="min-w-max py-1">
			<Level
				index={index}
				path={ROOT}
				depth={0}
				open={open}
				onToggle={toggle}
				currentDocId={currentDocId}
				actions={{
					...actions,
					addDoc: (path) => {
						// 만들자마자 그 안이 보여야 한다
						setOpen((prev) => new Set(prev).add(path.split("/").at(-2) ?? ""));
						actions.addDoc(path);
					},
				}}
				onNavigate={onNavigate}
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
	currentDocId,
	actions,
	onNavigate,
}: {
	index: StoreIndex;
	path: Path;
	depth: number;
	open: Set<string>;
	onToggle: (id: string) => void;
	currentDocId: string;
	actions: TreeActions;
	onNavigate?: () => void;
}) {
	const { folders, docs } = childrenOf(index, path);
	// 깊이를 패딩으로 준다. 이름이 길어지면 부모가 가로로 스크롤한다
	const indent = { paddingLeft: `${depth * 0.75 + 0.5}rem` };

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
			{folders.map((folder) => {
				const expanded = open.has(folder.id);
				return (
					<div key={folder.id}>
						<div className="group flex items-center">
							<button
								type="button"
								onClick={() => onToggle(folder.id)}
								style={indent}
								className="flex flex-1 items-center gap-1 rounded py-1 pr-2 text-left text-sm hover:bg-muted"
							>
								{expanded ? (
									<ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
								) : (
									<ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
								)}
								<FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
								<span className="whitespace-nowrap">{folder.name}</span>
							</button>

							{/*
							 * 가로 스크롤을 따라 흘러가지 않게 오른쪽에 붙여 둔다.
							 * +가 없으면 갓 만든 폴더에 원고를 넣을 길이 없다 — 머리말의
							 * 새 원고는 지금 보고 있는 원고 옆에 만든다.
							 */}
							<div className="sticky right-1 flex shrink-0 items-center bg-inherit">
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
								path={fullPath(folder)}
								depth={depth + 1}
								open={open}
								onToggle={onToggle}
								currentDocId={currentDocId}
								actions={actions}
								onNavigate={onNavigate}
							/>
						)}
					</div>
				);
			})}

			{docs.map((doc) => (
				<div
					key={doc.id}
					className={`group flex items-center rounded ${
						doc.id === currentDocId ? "bg-muted font-medium" : "hover:bg-muted"
					}`}
				>
					<Link
						to="/w/$docId"
						params={{ docId: doc.id }}
						onClick={onNavigate}
						style={{ paddingLeft: `${depth * 0.75 + 1.6}rem` }}
						className="flex flex-1 items-center gap-1 py-1 pr-2 text-sm"
					>
						<FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
						<span className="whitespace-nowrap">{displayTitle(doc)}</span>
					</Link>

					<div className="sticky right-1 flex shrink-0 items-center bg-inherit">
						<RowMenu label={`${displayTitle(doc)} 메뉴`}>
							<DropdownMenuItem onSelect={() => actions.duplicateDoc(doc)}>
								<CopyIcon />
								복제
							</DropdownMenuItem>
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
			<DropdownMenuContent align="end" className="w-40">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
