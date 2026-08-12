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
import { useEffect, useRef, useState } from "react";
import {
	ancestorIds,
	canMoveFolder,
	childrenOf,
	type DocEntry,
	displayTitle,
	type FolderEntry,
	fullPath,
	type Path,
	ROOT,
	type StoreIndex,
} from "#/lib/store";
import { Button } from "#/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/shared/ui/dropdown-menu";

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
	/*
	 * 끌어다 놓아 옮긴다. 다이얼로그를 거치는 moveDoc·moveFolder와 목적지는 같지만
	 * 고르는 방법이 달라 따로 둔다 — 이쪽은 갈 곳이 이미 정해져 있다.
	 */
	dropDoc: (docId: string, to: Path) => void;
	dropFolder: (folderId: string, to: Path) => void;
}

/** 끌고 있는 것. 폴더는 제 자손에 들어갈 수 없어 종류를 알아야 한다 */
type Drag = { kind: "doc" | "folder"; id: string };

/** 트리 전체가 나눠 쓰는 끌어 놓기 상태 */
interface Dnd {
	drag: Drag | null;
	/** 손이 올라가 있는 곳 */
	over: Path | null;
	canDrop: (to: Path) => boolean;
	onDragStart: (drag: Drag) => void;
	onDragEnd: () => void;
	onDragOver: (to: Path) => void;
	onDrop: (to: Path) => void;
	/** 손가락으로 누르기 시작했다. 오래 붙들고 있으면 끌기가 된다 */
	onPress: (drag: Drag, touch: React.Touch) => void;
}

/**
 * 손가락으로 이만큼 붙들고 있어야 끌기가 된다.
 *
 * 마우스에는 이 기다림이 없다 — 끌기와 누르기를 브라우저가 갈라 주기 때문이다.
 * 손가락은 그 둘이 같은 동작이라, 목록을 넘기려던 것과 구별하려면 시간이 든다.
 */
const LONG_PRESS = 500;

/** 기다리는 동안 이만큼 움직이면 넘기려던 손이다. 끌기로 치지 않는다 */
const PRESS_SLOP = 10;

/**
 * 길게 누르는 동안 글자가 잡히거나 확대 풍선이 뜨지 않게 한다.
 *
 * 목록의 제목은 읽는 것이지 긁어 가는 것이 아니라, 잃는 것이 없다.
 */
const NO_CALLOUT = "select-none [-webkit-touch-callout:none]";

/**
 * 놓을 수 있는 자리에 손이 올라왔을 때 줄에 입히는 표시.
 *
 * 놓을 수 없는 자리는 아무 표시도 하지 않는다 — 금지 표시를 그리는 것보다
 * 반응이 없는 편이 조용하다.
 */
function dropClass(dnd: Dnd, to: Path): string {
	return dnd.drag && dnd.over === to && dnd.canDrop(to)
		? "bg-accent ring-1 ring-ring"
		: "";
}

/**
 * 줄에 끌어 놓기를 붙인다. 폴더 줄은 제 안쪽을, 원고 줄은 제가 놓인 자리를 받는다.
 *
 * `data-drop-path`는 손가락 쪽에서 쓴다. 터치에는 "지금 이 줄 위에 있다"는 것을
 * 알려 주는 이벤트가 없어, 좌표로 줄을 찾아낸 뒤 이 값을 읽는다.
 */
function dropProps(dnd: Dnd, to: Path) {
	return {
		"data-drop-path": to,
		onDragOver: (e: React.DragEvent) => {
			if (!dnd.canDrop(to)) return;
			// 바깥의 root 영역까지 올라가면 목적지가 root로 덮인다
			e.stopPropagation();
			e.preventDefault();
			dnd.onDragOver(to);
		},
		onDrop: (e: React.DragEvent) => {
			e.stopPropagation();
			e.preventDefault();
			dnd.onDrop(to);
		},
	};
}

/**
 * 끌 수 있게 만든다.
 *
 * 마우스는 브라우저의 끌기를 그대로 쓴다 — dataTransfer를 채워야 시작된다.
 * 손가락에는 그 끌기가 오지 않으므로 길게 누르기로 따로 연다.
 */
function dragProps(dnd: Dnd, item: Drag, label: string) {
	return {
		draggable: true,
		onDragStart: (e: React.DragEvent) => {
			e.stopPropagation();
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", label);
			dnd.onDragStart(item);
		},
		onDragEnd: dnd.onDragEnd,
		onTouchStart: (e: React.TouchEvent) => {
			const touch = e.touches[0];
			// 손가락 두 개 이상은 확대하려는 것이다
			if (e.touches.length === 1 && touch) dnd.onPress(item, touch);
		},
	};
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
	currentFolderId,
	actions,
	onNavigate,
}: {
	index: StoreIndex;
	currentDocId: string;
	/** 지금 열어 둔 폴더. 원고 쪽에는 없다 */
	currentFolderId?: string;
	actions: TreeActions;
	/** 원고를 골랐을 때. 좁은 화면에서 서랍을 닫는 데 쓴다 */
	onNavigate?: () => void;
}) {
	// 지금 원고까지 가는 길은 펴 둔다
	const current = index.docs.find((d) => d.id === currentDocId);
	const [open, setOpen] = useState<Set<string>>(
		() => new Set(current ? ancestorIds(current.path) : []),
	);
	const [drag, setDrag] = useState<Drag | null>(null);
	/** 지금 손이 올라가 있는 폴더의 안쪽 경로. 빈 곳이면 root다 */
	const [over, setOver] = useState<Path | null>(null);

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

	/** 지금 끌고 있는 것을 이 경로에 놓을 수 있는가 */
	const canDrop = (to: Path): boolean => {
		if (!drag) return false;
		if (drag.kind === "folder") {
			const folder = index.folders.find((f) => f.id === drag.id);
			// 제 자신·제 자손 안으로는 갈 수 없다. 사슬이 끊긴다
			return !!folder && canMoveFolder(folder, to);
		}
		// 이미 그 자리에 있으면 옮길 것이 없다
		return index.docs.find((d) => d.id === drag.id)?.path !== to;
	};

	const drop = (to: Path) => {
		if (drag && canDrop(to)) {
			if (drag.kind === "doc") actions.dropDoc(drag.id, to);
			else actions.dropFolder(drag.id, to);
		}
		setDrag(null);
		setOver(null);
	};

	/** 손가락이 붙들고 있는 중. 시간을 다 채우면 끌기가 된다 */
	const press = useRef<{
		item: Drag;
		x: number;
		y: number;
		timer: number;
	} | null>(null);
	/** 방금 끌기로 끝났다. 뒤따라오는 탭을 삼키는 데 쓴다 */
	const dragged = useRef(false);
	/*
	 * 손가락이 아직 화면에 있다.
	 *
	 * 브라우저의 링크 메뉴를 막을지 가리는 데 쓴다. drag 상태로는 늦다 — 메뉴가
	 * 뜨는 때와 끌기가 열리는 때가 같은 0.5초라, 다시 그려지기 전에 판정해야 한다.
	 */
	const touching = useRef(false);

	const forgetPress = () => {
		if (press.current) window.clearTimeout(press.current.timer);
		press.current = null;
	};

	const onPress = (item: Drag, touch: React.Touch) => {
		forgetPress();
		dragged.current = false;
		touching.current = true;
		press.current = {
			item,
			x: touch.clientX,
			y: touch.clientY,
			timer: window.setTimeout(() => {
				press.current = null;
				setDrag(item);
				// 끌기가 열렸다는 것을 손끝에 알린다. 없는 기기도 있다
				navigator.vibrate?.(10);
			}, LONG_PRESS),
		};
	};

	/*
	 * 손가락으로 끄는 동안의 추적.
	 *
	 * 창에 직접 얹는다. React가 거는 touchmove는 passive라 목록이 따라 스크롤되는
	 * 것을 막을 수 없다.
	 *
	 * 끌기 상태가 바뀔 때만 다시 건다. 의존성을 비우면 손가락이 움직일 때마다
	 * 리스너를 떼었다 붙이게 된다 — touchmove마다 렌더가 도는 자리다. drop이 들고
	 * 있는 색인은 끄는 동안 바뀌지 않는다. 색인을 고치는 것이 놓는 순간이라,
	 * 그때는 이미 이 손짓이 끝나 있다.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: 위 설명 참고
	useEffect(() => {
		const move = (e: TouchEvent) => {
			const touch = e.touches[0];
			if (!touch) return;

			if (drag) {
				// 끌고 있는 동안에는 목록이 함께 움직이지 않아야 한다
				e.preventDefault();
				const row = document
					.elementFromPoint(touch.clientX, touch.clientY)
					?.closest<HTMLElement>("[data-drop-path]");
				setOver(row?.dataset.dropPath ?? null);
				return;
			}

			// 아직 기다리는 중이다. 움직였으면 넘기려던 손으로 본다
			const waiting = press.current;
			if (!waiting) return;
			const strayed = Math.hypot(
				touch.clientX - waiting.x,
				touch.clientY - waiting.y,
			);
			if (strayed > PRESS_SLOP) forgetPress();
		};

		const end = () => {
			forgetPress();
			touching.current = false;
			if (!drag) return;
			// 놓을 자리를 벗어난 채 손을 떼면 아무 일도 없다
			if (over) drop(over);
			else {
				setDrag(null);
				setOver(null);
			}
			// 손을 뗀 뒤 따라오는 탭이 원고를 열거나 폴더를 접지 않게 한다
			dragged.current = true;
			window.setTimeout(() => {
				dragged.current = false;
			}, 300);
		};

		window.addEventListener("touchmove", move, { passive: false });
		window.addEventListener("touchend", end);
		window.addEventListener("touchcancel", end);
		return () => {
			window.removeEventListener("touchmove", move);
			window.removeEventListener("touchend", end);
			window.removeEventListener("touchcancel", end);
		};
	}, [drag, over]);

	// 세워 둔 타이머를 남기지 않는다
	useEffect(
		() => () => {
			if (press.current) window.clearTimeout(press.current.timer);
		},
		[],
	);

	const dnd: Dnd = {
		drag,
		over,
		canDrop,
		onDragStart: setDrag,
		onDragEnd: () => {
			setDrag(null);
			setOver(null);
		},
		onDragOver: setOver,
		onDrop: drop,
		onPress,
	};

	return (
		/*
		 * 빈 곳에 놓으면 root로 나온다. 폴더 밖으로 꺼낼 다른 길이 없다.
		 *
		 * 트리가 짧으면 빈 곳도 좁으므로 아래로 넉넉히 늘린다.
		 */
		// biome-ignore lint/a11y/noStaticElementInteractions: 끌어 놓기는 마우스 전용이다. 키보드로는 ⋯ 메뉴의 이동을 쓴다
		<div
			// 줄끼리 붙여 두면 어느 것을 눌렀는지 손가락이 헷갈린다
			className={`flex min-w-max flex-1 flex-col gap-1 py-1 ${NO_CALLOUT} ${
				drag && over === ROOT && canDrop(ROOT) ? "bg-accent/60" : ""
			}`}
			data-drop-path={ROOT}
			/*
			 * 끌기로 끝난 손짓에는 탭이 뒤따라온다. 그대로 두면 옮기자마자 그 원고가
			 * 열리거나 폴더가 접힌다.
			 */
			onClickCapture={(e) => {
				if (!dragged.current) return;
				dragged.current = false;
				e.preventDefault();
				e.stopPropagation();
			}}
			/*
			 * 손가락으로 길게 누르면 브라우저가 링크 메뉴를 띄운다 — 원고 줄이 링크라
			 * "새 탭에서 열기"가 끌기 위로 겹쳐 올라온다.
			 *
			 * 누르고 있는 중일 때만 막는다. 마우스 오른쪽 누르기는 그대로 두어야
			 * 데스크톱에서 원고를 새 탭으로 여는 길이 남는다.
			 */
			onContextMenu={(e) => {
				if (touching.current || drag) e.preventDefault();
			}}
			onDragOver={(e) => {
				// 여기서 막지 않으면 브라우저가 놓기를 거부한다
				if (!canDrop(ROOT)) return;
				e.preventDefault();
				setOver(ROOT);
			}}
			onDrop={(e) => {
				e.preventDefault();
				drop(ROOT);
			}}
		>
			<Level
				index={index}
				path={ROOT}
				depth={0}
				open={open}
				onToggle={toggle}
				currentDocId={currentDocId}
				currentFolderId={currentFolderId}
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
	currentFolderId,
	actions,
	onNavigate,
	dnd,
}: {
	index: StoreIndex;
	path: Path;
	depth: number;
	open: Set<string>;
	onToggle: (id: string) => void;
	currentDocId: string;
	currentFolderId?: string;
	actions: TreeActions;
	onNavigate?: () => void;
	dnd: Dnd;
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
				const inside = fullPath(folder);
				const dragging = dnd.drag?.id === folder.id;
				return (
					// 폴더 줄과 그 안의 것들 사이도 바깥과 같은 간격으로 벌린다
					<div key={folder.id} className="flex flex-col gap-1">
						{/* 폴더는 제 안쪽을 받는다. 끌고 있는 그 폴더 자신은 흐리게 둔다 */}
						<div
							className={`group flex items-center rounded ${
								folder.id === currentFolderId ? "bg-muted font-medium" : ""
							} ${dropClass(dnd, inside)} ${NO_CALLOUT} ${
								dragging ? "opacity-40" : ""
							}`}
							{...dragProps(
								dnd,
								{ kind: "folder", id: folder.id },
								folder.name,
							)}
							{...dropProps(dnd, inside)}
						>
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
								onClick={onNavigate}
								className="flex flex-1 items-center gap-1 rounded py-1 pr-2 text-left text-sm hover:bg-muted"
							>
								<FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
								<span className="whitespace-nowrap">{folder.name}</span>
							</Link>

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
								path={inside}
								depth={depth + 1}
								open={open}
								onToggle={onToggle}
								currentDocId={currentDocId}
								currentFolderId={currentFolderId}
								actions={actions}
								onNavigate={onNavigate}
								dnd={dnd}
							/>
						)}
					</div>
				);
			})}

			{docs.map((doc) => (
				/*
				 * 원고 줄도 놓는 자리를 받는다. 제가 놓인 폴더를 목적지로 넘기므로,
				 * 원고 사이에 떨어뜨려도 그 폴더로 들어간다. 촘촘한 목록에서 폴더 줄만
				 * 노려 맞히지 않아도 된다.
				 */
				<div
					key={doc.id}
					className={`group flex items-center rounded ${
						doc.id === currentDocId ? "bg-muted font-medium" : "hover:bg-muted"
					} ${dropClass(dnd, path)} ${dnd.drag?.id === doc.id ? "opacity-40" : ""} ${NO_CALLOUT}`}
					{...dragProps(dnd, { kind: "doc", id: doc.id }, displayTitle(doc))}
					{...dropProps(dnd, path)}
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
			<DropdownMenuContent align="end" className="w-48">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
