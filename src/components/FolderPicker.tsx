import { ChevronRightIcon, FolderIcon, HomeIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	canMoveFolder,
	childrenOf,
	fullPath,
	type Path,
	ROOT,
	type StoreIndex,
} from "#/lib/store";

/**
 * 옮길 자리를 고르는 창.
 *
 * 끌어다 놓기는 두지 않는다. 좁은 화면에서 잘 되지 않고, 트리가 접혀 있으면
 * 목적지가 화면에 없을 때가 많다. 목록에서 고르는 편이 확실하다.
 *
 * 폴더를 옮길 때는 자기 자신과 자기 자손을 고를 수 없다 — 순환이 생기면 트리가
 * 끊긴다. 고를 수 없는 자리는 흐리게 두되 목록에서 지우지는 않는다. 없어진
 * 것처럼 보이면 어디 있었는지 헤매게 된다.
 */
export function FolderPicker({
	open,
	onOpenChange,
	index,
	title,
	/** 옮기려는 폴더. 원고를 옮길 때는 없다 */
	movingFolderId,
	currentPath,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	index: StoreIndex;
	title: string;
	movingFolderId?: string;
	currentPath: Path;
	onPick: (path: Path) => void;
}) {
	const [picked, setPicked] = useState<Path>(currentPath);

	// 열 때마다 지금 자리에서 시작한다
	useEffect(() => {
		if (open) setPicked(currentPath);
	}, [open, currentPath]);

	const moving = movingFolderId
		? index.folders.find((f) => f.id === movingFolderId)
		: undefined;

	/** 이 자리로 갈 수 있는가 */
	const allowed = (path: Path) =>
		moving ? canMoveFolder(moving, path) : path !== currentPath;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>옮길 자리를 고르세요.</DialogDescription>
				</DialogHeader>

				<div className="max-h-72 overflow-auto rounded border border-border">
					<div className="min-w-max py-1">
						<Row
							label="맨 위"
							icon={<HomeIcon className="size-3.5 shrink-0" />}
							depth={0}
							picked={picked === ROOT}
							disabled={!allowed(ROOT)}
							onPick={() => setPicked(ROOT)}
						/>
						<Branch
							index={index}
							path={ROOT}
							depth={1}
							picked={picked}
							allowed={allowed}
							onPick={setPicked}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
						취소
					</Button>
					<Button
						size="sm"
						disabled={!allowed(picked)}
						onClick={() => {
							onPick(picked);
							onOpenChange(false);
						}}
					>
						옮기기
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function Branch({
	index,
	path,
	depth,
	picked,
	allowed,
	onPick,
}: {
	index: StoreIndex;
	path: Path;
	depth: number;
	picked: Path;
	allowed: (path: Path) => boolean;
	onPick: (path: Path) => void;
}) {
	// 고르는 창이므로 폴더만 그린다. 원고는 자리가 아니다
	const { folders } = childrenOf(index, path);

	return (
		<>
			{folders.map((folder) => {
				const here = fullPath(folder);
				return (
					<div key={folder.id}>
						<Row
							label={folder.name}
							icon={<FolderIcon className="size-3.5 shrink-0" />}
							depth={depth}
							picked={picked === here}
							disabled={!allowed(here)}
							onPick={() => onPick(here)}
						/>
						{/* 접지 않는다. 옮길 자리를 찾는 동안 펼치는 품이 더 든다 */}
						<Branch
							index={index}
							path={here}
							depth={depth + 1}
							picked={picked}
							allowed={allowed}
							onPick={onPick}
						/>
					</div>
				);
			})}
		</>
	);
}

function Row({
	label,
	icon,
	depth,
	picked,
	disabled,
	onPick,
}: {
	label: string;
	icon: React.ReactNode;
	depth: number;
	picked: boolean;
	disabled: boolean;
	onPick: () => void;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onPick}
			style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
			className={`flex w-full items-center gap-1.5 py-1.5 pr-3 text-left text-sm disabled:opacity-40 ${
				picked ? "bg-muted font-medium" : "enabled:hover:bg-muted/60"
			}`}
		>
			{icon}
			<span className="whitespace-nowrap">{label}</span>
			{picked && <ChevronRightIcon className="size-3.5 shrink-0" />}
		</button>
	);
}
