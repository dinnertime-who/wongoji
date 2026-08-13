import { FileTextIcon, FolderIcon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import {
	countDocsUnder,
	daysLeft,
	displayTitle,
	type StoreIndex,
	TRASH_DAYS,
	type TrashEntry,
	useArchive,
	useArchiveMutation,
} from "#/entities/archive";

import { Button } from "#/shared/ui/button";
import { ConfirmDialog } from "#/shared/ui/confirm-dialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/shared/ui/dialog";

/**
 * 휴지통.
 *
 * 버린 것은 {@link TRASH_DAYS}일 뒤에 사라진다. 남은 날을 줄마다 적어 둔다 —
 * "언제 지워지는지 모르는 채로 쌓여 있는 것"이 가장 불안하다.
 *
 * 폴더를 되살리면 함께 버려진 것들도 함께 온다. 원래 자리가 사라졌으면 살아
 * 있는 가장 가까운 조상으로, 거기까지 없으면 맨 위로 간다.
 *
 * **본문을 여기서 지우지 않는다.** 지우는 연산 하나를 서버에 보내면 목록과
 * 본문이 함께 간다. 전에는 이 화면이 색인을 고친 뒤 본문 키를 따로 지웠는데,
 * 그 순서를 화면이 기억해야 한다는 것 자체가 빠뜨릴 자리였다.
 */
export function TrashDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { index } = useArchive();
	const change = useArchiveMutation();
	/** 완전 삭제 전에 확인받을 대상. `"all"`이면 전부 비우기 */
	const [confirming, setConfirming] = useState<TrashEntry | "all" | null>(null);

	// 최근에 버린 것이 위로
	const entries = [...index.trash].sort((a, b) => b.deletedAt - a.deletedAt);

	const erase = () => {
		if (confirming === "all") void change({ kind: "purgeAll" });
		else if (confirming) void change({ kind: "purge", ids: [confirming.id] });
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
						<>
							<ul className="max-h-80 divide-y divide-border overflow-auto rounded border border-border">
								{entries.map((entry) => (
									<Row
										key={entry.id}
										entry={entry}
										index={index}
										onUndo={() =>
											void change({ kind: "restore", id: entry.id })
										}
										onErase={() => setConfirming(entry)}
									/>
								))}
							</ul>

							{/*
							 * 하나씩 지우는 것과 나란히 두지 않고 목록 아래에 따로 둔다.
							 * 되돌릴 수 없는 것 중에서도 제일 큰 것이라, 줄 사이에 섞여
							 * 있으면 옆 줄의 단추를 누르려다 닿는다.
							 */}
							<div className="flex justify-end">
								<Button
									variant="ghost"
									size="sm"
									className="text-destructive hover:text-destructive"
									onClick={() => setConfirming("all")}
								>
									전부 비우기
								</Button>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={confirming !== null}
				onOpenChange={(next) => !next && setConfirming(null)}
				title={
					confirming === "all" ? "휴지통을 비울까요?" : "완전히 삭제할까요?"
				}
				description={erasing(confirming, index)}
				confirmLabel={confirming === "all" ? "비우기" : "지우기"}
				onConfirm={erase}
			/>
		</>
	);
}

/**
 * 무엇이 사라지는지 적는다.
 *
 * **원고가 몇 편인지 반드시 적는다.** 폴더 하나를 지우는 것처럼 보이는 일이
 * 실제로는 그 안의 원고를 데려가고, 그것이 되돌릴 수 없는 유일한 자리다.
 */
function erasing(
	confirming: TrashEntry | "all" | null,
	index: StoreIndex,
): string {
	if (confirming === null) return "";

	if (confirming === "all") {
		const docs = index.trash.filter((t) => t.kind === "doc").length;
		const 원고 = docs > 0 ? ` 원고 ${docs}편이 함께 사라집니다.` : "";
		return `휴지통에 있는 ${index.trash.length}개를 모두 지웁니다.${원고} 이 작업은 되돌릴 수 없습니다.`;
	}

	return `${label(confirming, index)}을(를) 지웁니다. 이 작업은 되돌릴 수 없습니다.`;
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
