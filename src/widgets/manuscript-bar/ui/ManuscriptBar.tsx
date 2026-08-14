import { ChevronDownIcon } from "lucide-react";
import {
	DOC_STATUSES,
	type DocStatus,
	STATUS_LABEL,
	StatusIcon,
	statusOf,
} from "#/entities/archive";
import {
	goalProgress,
	goalRatio,
	type LayoutStats,
	remainingLines,
} from "#/entities/manuscript";
import { Button } from "#/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/shared/ui/dropdown-menu";
import { Input } from "#/shared/ui/input";
import { Label } from "#/shared/ui/label";
import { PageTitle } from "#/shared/ui/page-title";
import { Progress } from "#/shared/ui/progress";

/**
 * 제목과 분량 목표.
 *
 * 원고와 원고지 미리보기 위에 가로로 걸친다. 둘 중 어느 쪽을 보고 있든
 * 제목과 남은 분량은 늘 보여야 한다.
 *
 * 공모전 요강은 "200자 원고지 10매 내외", "70매 안팎"처럼 매수로 분량을 정한다.
 * 근거는 docs/contest-features.md.
 */
export function ManuscriptBar({
	title,
	onTitleChange,
	goal,
	onGoalChange,
	stats,
	status,
	onStatusChange,
	onOpenHistory,
}: {
	title: string;
	onTitleChange: (value: string) => void;
	/** 목표 매수. 0이면 목표를 두지 않은 것이다 */
	goal: number;
	onGoalChange: (value: number) => void;
	stats: LayoutStats;
	/** 진행 상태. 비어 있으면 초고다 */
	status?: DocStatus | null;
	onStatusChange?: (next: DocStatus) => void;
	onOpenHistory?: () => void;
}) {
	// 비어 있는 원고도 초고로 읽는다 — 상태가 생기기 전에 쓴 것들이다
	const current = statusOf(status);

	/*
	 * 남은 분량도 조판 기준으로 센다. 글자로 세면 `68 / 70매` 옆에 "1,200자
	 * 남음"이 뜨는 일이 생긴다 — 두 숫자가 서로 다른 자를 쓰기 때문이다.
	 */
	const remaining = goal > 0 ? remainingLines(stats.lines, goal) : 0;
	const ratio = goalRatio(stats.lines, goal);
	const over = remaining < 0;

	return (
		<div className="mx-auto w-full max-w-6xl px-4 pt-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="min-w-0 flex-1">
					<PageTitle
						value={title}
						onChange={onTitleChange}
						placeholder="제목 없음"
						label="제목"
					/>
				</div>

				{/*
				 * 상태와 이력. 어느 원고에나 상태가 있으므로 늘 지금 상태가 적힌다 —
				 * 여는 순간 "이 글은 초고다"가 보이고, 고르는 일은 켜는 일이 아니라
				 * 다음으로 옮기는 일이 된다.
				 *
				 * **여기서만 아이콘과 글씨를 함께 둔다.** 목록에서는 아이콘만 그리므로,
				 * 어떤 동그라미가 무슨 뜻인지 배우는 자리가 어딘가에 있어야 한다.
				 */}
				{onStatusChange && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-10 shrink-0 text-xs"
							>
								<StatusIcon
									status={current}
									labelled={false}
									className="size-3.5"
									data-icon="inline-start"
								/>
								{STATUS_LABEL[current]}
								<ChevronDownIcon data-icon="inline-end" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{DOC_STATUSES.map((next) => (
								<DropdownMenuItem
									key={next}
									onSelect={() => onStatusChange(next)}
									disabled={next === current}
								>
									<StatusIcon
										status={next}
										labelled={false}
										className="size-4.5"
									/>
									{STATUS_LABEL[next]}
								</DropdownMenuItem>
							))}
							{/*
							 * "라벨 떼기"는 없앴다. 기본이 초고라 되돌아갈 없음이 없고,
							 * 떼려던 사람은 초고를 고르면 같은 자리로 온다.
							 */}
							{onOpenHistory && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem onSelect={onOpenHistory}>
										이력
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
				<div className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-[var(--paper)] px-2.5 text-xs">
					<Label htmlFor="goal" className="text-muted-foreground">
						목표
					</Label>
					<Input
						id="goal"
						type="number"
						min={0}
						max={9999}
						value={goal || ""}
						onChange={(e) => onGoalChange(Number(e.target.value) || 0)}
						placeholder="—"
						className="h-auto w-11 border-0 bg-transparent p-0 text-right text-xs tabular-nums shadow-none focus-visible:ring-0"
					/>
					<span className="text-muted-foreground">매</span>
				</div>
			</div>

			<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
				<span className={over ? "text-foreground" : "text-muted-foreground"}>
					{/* 목표가 없으면 매수만 — 바로 아래 줄에 글자 수가 따로 있다 */}
					{goalProgress(stats.sheets, goal) ?? `${stats.sheets}매`}
				</span>
				{goal > 0 && (
					<span className="text-muted-foreground">
						{over
							? `${(-remaining).toLocaleString()}줄 초과`
							: `${remaining.toLocaleString()}줄 남음`}
					</span>
				)}
				{/* 매수가 곧 장수가 되었으므로 여기서는 글자 수만 곁들인다 */}
				<span className="text-muted-foreground">
					{stats.chars.toLocaleString()}자
				</span>
			</div>

			{goal > 0 && (
				<Progress
					value={ratio * 100}
					aria-label="분량 목표 진행"
					className={`mt-1.5 h-1 bg-muted ${
						over
							? "[&>[data-slot=progress-indicator]]:bg-[var(--ink)]"
							: "[&>[data-slot=progress-indicator]]:bg-[var(--grid)]"
					}`}
				/>
			)}
		</div>
	);
}
