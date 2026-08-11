import { Link } from "@tanstack/react-router";
import {
	ChevronDownIcon,
	ChevronRightIcon,
	FileTextIcon,
	FolderIcon,
	PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	ancestorIds,
	childrenOf,
	displayTitle,
	fullPath,
	type Path,
	ROOT,
	type StoreIndex,
} from "#/lib/store";

/**
 * 폴더 트리.
 *
 * root는 폴더로 그리지 않는다 — 그 안의 것들이 맨 위에 온다.
 * 이름은 줄임표로 자르지 않고 가로로 넘긴다. 트리가 깊어지면 미는 편이 낫다.
 */
export function ManuscriptTree({
	index,
	currentDocId,
	onAddDoc,
	onNavigate,
}: {
	index: StoreIndex;
	currentDocId: string;
	/** 이 폴더 안에 원고를 하나 만든다 */
	onAddDoc: (path: Path) => void;
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
				onAddDoc={(path) => {
					// 만들자마자 그 안이 보여야 한다
					setOpen((prev) => new Set(prev).add(path.split("/").at(-2) ?? ""));
					onAddDoc(path);
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
	onAddDoc,
	onNavigate,
}: {
	index: StoreIndex;
	path: Path;
	depth: number;
	open: Set<string>;
	onToggle: (id: string) => void;
	currentDocId: string;
	onAddDoc: (path: Path) => void;
	onNavigate?: () => void;
}) {
	const { folders, docs } = childrenOf(index, path);
	// 깊이를 패딩으로 준다. 이름이 길어지면 부모가 가로로 스크롤한다
	const indent = { paddingLeft: `${depth * 0.75 + 0.5}rem` };

	return (
		<>
			{folders.map((folder) => {
				const expanded = open.has(folder.id);
				return (
					<div key={folder.id}>
						{/*
						 * 폴더 줄 오른쪽 끝에 +를 붙인다. 없으면 갓 만든 폴더에 원고를 넣을
						 * 길이 없다 — 머리말의 새 원고는 지금 보고 있는 원고 옆에 만든다.
						 */}
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
							<Button
								variant="ghost"
								size="icon-xs"
								// 가로 스크롤을 따라 흘러가지 않게 오른쪽에 붙여 둔다
								className="sticky right-1 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
								onClick={() => onAddDoc(fullPath(folder))}
								title={`${folder.name}에 새 원고`}
								aria-label={`${folder.name}에 새 원고`}
							>
								<PlusIcon />
							</Button>
						</div>
						{expanded && (
							<Level
								index={index}
								path={fullPath(folder)}
								depth={depth + 1}
								open={open}
								onToggle={onToggle}
								currentDocId={currentDocId}
								onAddDoc={onAddDoc}
								onNavigate={onNavigate}
							/>
						)}
					</div>
				);
			})}

			{docs.map((doc) => (
				<Link
					key={doc.id}
					to="/w/$docId"
					params={{ docId: doc.id }}
					onClick={onNavigate}
					style={{ paddingLeft: `${depth * 0.75 + 1.6}rem` }}
					className={`flex items-center gap-1 rounded py-1 pr-2 text-sm hover:bg-muted ${
						doc.id === currentDocId ? "bg-muted font-medium" : ""
					}`}
				>
					<FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
					<span className="whitespace-nowrap">{displayTitle(doc)}</span>
				</Link>
			))}
		</>
	);
}
