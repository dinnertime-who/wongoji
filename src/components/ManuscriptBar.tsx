import { CELLS_PER_SHEET, type LayoutStats } from "#/lib/wongoji";

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
}: {
	title: string;
	onTitleChange: (value: string) => void;
	/** 목표 매수. 0이면 목표를 두지 않은 것이다 */
	goal: number;
	onGoalChange: (value: number) => void;
	stats: LayoutStats;
}) {
	const remaining = goal > 0 ? goal * CELLS_PER_SHEET - stats.chars : 0;
	const ratio =
		goal > 0 ? Math.min(1, stats.chars / (goal * CELLS_PER_SHEET)) : 0;
	const over = remaining < 0;

	return (
		<div className="no-print mx-auto w-full max-w-6xl px-4 pt-4">
			<div className="flex flex-wrap items-center gap-2">
				<input
					value={title}
					onChange={(e) => onTitleChange(e.target.value)}
					placeholder="제목"
					aria-label="제목"
					className="min-w-0 flex-1 rounded border border-[var(--hairline)] bg-[var(--paper)] px-3 py-2 text-center text-lg outline-none placeholder:text-[var(--muted)] focus:border-[var(--grid)]"
				/>
				<label className="flex shrink-0 items-center gap-1.5 rounded border border-[var(--hairline)] bg-[var(--paper)] px-2.5 py-2 text-xs">
					<span className="text-[var(--muted)]">목표</span>
					<input
						type="number"
						min={0}
						max={9999}
						value={goal || ""}
						onChange={(e) => onGoalChange(Number(e.target.value) || 0)}
						placeholder="—"
						aria-label="목표 매수"
						className="w-12 bg-transparent text-right tabular-nums outline-none placeholder:text-[var(--muted)]"
					/>
					<span className="text-[var(--muted)]">매</span>
				</label>
			</div>

			<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
				<span className={over ? "text-[var(--ink)]" : "text-[var(--muted)]"}>
					{goal > 0 ? `${stats.sheets} / ${goal}매` : `${stats.sheets}매`}
				</span>
				{goal > 0 && (
					<span className="text-[var(--muted)]">
						{over
							? `${(-remaining).toLocaleString()}자 초과`
							: `${remaining.toLocaleString()}자 남음`}
					</span>
				)}
				<span className="text-[var(--muted)]">
					{stats.chars.toLocaleString()}자 · {stats.pages}장
				</span>
			</div>

			{goal > 0 && (
				<div
					className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
					role="progressbar"
					aria-valuenow={Math.round(ratio * 100)}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label="분량 목표 진행"
				>
					<div
						className={`h-full rounded-full transition-[width] ${
							over ? "bg-[var(--ink)]" : "bg-[var(--grid)]"
						}`}
						style={{ width: `${ratio * 100}%` }}
					/>
				</div>
			)}
		</div>
	);
}
