import { FileTextIcon, FolderIcon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "#/components/ConfirmDialog";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	countDocsUnder,
	daysLeft,
	displayTitle,
	mutateIndex,
	purge,
	removeDoc,
	restore,
	type SaveResult,
	type StoreIndex,
	TRASH_DAYS,
	type TrashEntry,
} from "#/lib/store";

/**
 * 휴지통.
 *
 * 버린 것은 {@link TRASH_DAYS}일 뒤에 사라진다. 남은 날을 줄마다 적어 둔다 —
 * "언제 지워지는지 모르는 채로 쌓여 있는 것"이 가장 불안하다.
 *
 * 폴더를 되살리면 함께 버려진 것들도 함께 온다. 원래 자리가 사라졌으면 살아
 * 있는 가장 가까운 조상으로, 거기까지 없으면 맨 위로 간다.
 */
export function TrashDialog({
	open,
	onOpenChange,
	index,
	onReport,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	index: StoreIndex;
	onReport: (result: SaveResult) => void;
}) {
	/** 완전 삭제 전에 확인받을 대상 */
	const [confirming, setConfirming] = useState<TrashEntry | null>(null);

	// 최근에 버린 것이 위로
	const entries = [...index.trash].sort((a, b) => b.deletedAt - a.deletedAt);

	const undo = (id: string) => {
		const { result } = mutateIndex((current) => restore(current, id));
		onReport(result);
	};

	const erase = (entry: TrashEntry) => {
		let bodies: string[] = [];
		const { result } = mutateIndex((current) => {
			const { index: next, removedDocIds } = purge(current, [entry.id]);
			bodies = removedDocIds;
			return next;
		});

		/*
		 * 색인에서 뺀 본문 키도 함께 지운다 — 두면 자리만 먹는 고아가 된다.
		 * 다만 색인이 실제로 써진 뒤다. 순서를 뒤집으면 쓰기가 실패했을 때
		 * 휴지통에는 그대로 있는데 본문만 사라져 되살릴 수 없게 된다.
		 */
		if (result.ok) for (const id of bodies) removeDoc(id);

		onReport(result);
		setConfirming(null);
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>휴지통</DialogTitle>
						<DialogDescription>
							버린 지 {TRASH_DAYS}일이 지나면 사라집니다.
						</DialogDescription>
					</DialogHeader>

					{entries.length === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							비어 있습니다.
						</p>
					) : (
						<ul className="max-h-80 divide-y divide-border overflow-auto rounded border border-border">
							{entries.map((entry) => (
								<Row
									key={entry.id}
									entry={entry}
									index={index}
									onUndo={() => undo(entry.id)}
									onErase={() => setConfirming(entry)}
								/>
							))}
						</ul>
					)}
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={confirming !== null}
				onOpenChange={(next) => !next && setConfirming(null)}
				title="완전히 삭제할까요?"
				description={`${confirming ? label(confirming, index) : ""}을(를) 지웁니다. 이 작업은 되돌릴 수 없습니다.`}
				confirmLabel="지우기"
				onConfirm={() => confirming && erase(confirming)}
			/>
		</>
	);
}

function Row({
	entry,
	index,
	onUndo,
	onErase,
}: {
	entry: TrashEntry;
	index: StoreIndex;
	onUndo: () => void;
	onErase: () => void;
}) {
	const left = daysLeft(entry);

	return (
		<li className="flex items-center gap-2 px-3 py-2 text-sm">
			{entry.kind === "folder" ? (
				<FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
			) : (
				<FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
			)}

			<span className="min-w-0 flex-1 truncate">{label(entry, index)}</span>

			<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
				{left}일 남음
			</span>

			<Button
				variant="ghost"
				size="icon-xs"
				onClick={onUndo}
				title="되살리기"
				aria-label="되살리기"
			>
				<Undo2Icon />
			</Button>
			<Button
				variant="ghost"
				size="sm"
				className="text-destructive hover:text-destructive"
				onClick={onErase}
			>
				완전 삭제
			</Button>
		</li>
	);
}

/**
 * 줄에 적을 이름.
 *
 * 폴더는 담고 있던 원고 수를 함께 보여 준다. 폴더 하나가 무엇을 데리고 갔는지
 * 알아야 되살릴지 정할 수 있다.
 */
function label(entry: TrashEntry, index: StoreIndex): string {
	if (entry.kind === "doc") return displayTitle(entry);
	const count = countDocsUnder(index, entry.id);
	return count > 0 ? `${entry.name} (원고 ${count}편)` : entry.name;
}
