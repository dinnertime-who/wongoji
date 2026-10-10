import { InfoIcon } from "lucide-react";
import type { CURRENT_ANNOUNCEMENT } from "#/shared/config/announcement";
import { Button } from "#/shared/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/shared/ui/dialog";

function ExampleCells({ cells }: { cells: readonly string[] }) {
	return (
		<div className="inline-flex border-t border-l border-grid">
			{cells.map((glyphs, index) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: 예시의 원고지 칸 좌표는 고정되어 있다.
					key={index}
					className="flex size-10 items-center justify-center border-r border-b border-grid"
				>
					{glyphs}
				</span>
			))}
		</div>
	);
}

export function AnnouncementDetails({
	announcement,
}: {
	announcement: typeof CURRENT_ANNOUNCEMENT;
}) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<button
					type="button"
					className="inline-flex min-h-8 items-center gap-1.5 rounded-sm text-xs font-medium underline underline-offset-4 outline-none transition-colors hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
				>
					<InfoIcon aria-hidden="true" className="size-3.5" />
					업데이트 내용 보기
				</button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="leading-6">{announcement.title}</DialogTitle>
					<DialogDescription className="leading-6">
						{announcement.description}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-wrap gap-x-8 gap-y-4 rounded-sm bg-grid-soft p-4">
					<div>
						<p className="mb-2 text-xs text-muted-foreground">기존 배치</p>
						<ExampleCells cells={announcement.example.before} />
					</div>
					<div>
						<p className="mb-2 text-xs font-medium">개선된 배치</p>
						<ExampleCells cells={announcement.example.after} />
					</div>
				</div>
				<p className="text-sm leading-6 text-muted-foreground">
					{announcement.note}
				</p>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">닫기</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
