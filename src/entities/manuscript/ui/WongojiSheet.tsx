import { type Cell, COLS, type Page, ROWS } from "../lib/typesetting";

/** 온점·반점은 칸의 왼쪽 아래 구석에 치우쳐 쓴다 */
const CORNER_PUNCT = new Set([".", ","]);

function cellClass(cell: Cell): string {
	if (cell.glyphs.length === 0) return "";
	const [first] = cell.glyphs;
	if (cell.glyphs.length === 1 && CORNER_PUNCT.has(first)) {
		return "items-end justify-start pb-[0.1em] pl-[0.15em]";
	}
	return "items-center justify-center";
}

/**
 * 한 칸에 글리프가 여럿 들어가는 경우(숫자 2자, 줄 끝 부호 병합, 닫는 따옴표+마침표)
 * 칸을 넘지 않도록 글자를 좁힌다.
 */
function glyphScale(count: number): string {
	if (count >= 3) return "text-[0.44em] tracking-tight";
	if (count === 2) return "text-[0.62em] tracking-tight";
	return "";
}

function WongojiCell({ cell }: { cell: Cell | undefined }) {
	const glyphs = cell?.glyphs ?? [];
	return (
		<div
			className={`flex aspect-square border-r border-b border-[var(--grid)] leading-none ${
				cell ? cellClass(cell) : ""
			}`}
		>
			{glyphs.length > 0 && (
				<span className={`flex ${glyphScale(glyphs.length)}`}>
					{glyphs.join("")}
				</span>
			)}
		</div>
	);
}

export function WongojiSheet({ page, index }: { page: Page; index: number }) {
	return (
		<section
			className="wongoji-sheet rounded-sm border border-[var(--grid)] bg-[var(--paper)] p-4 shadow-sm sm:p-6"
			aria-label={`원고지 ${index + 1}장`}
		>
			<div
				className="grid border-t border-l border-[var(--grid)] text-[clamp(0.7rem,2.1vw,1.05rem)]"
				style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
			>
				{Array.from({ length: ROWS }, (_, row) =>
					Array.from({ length: COLS }, (_, col) => (
						<WongojiCell
							// biome-ignore lint/suspicious/noArrayIndexKey: 격자는 크기가 고정이고 순서가 바뀌지 않는다. 좌표가 곧 칸의 정체성이다.
							key={`${row}-${col}`}
							cell={page.lines[row]?.cells[col]}
						/>
					)),
				)}
			</div>
			<footer className="mt-2 text-right text-[0.7rem] text-muted-foreground tabular-nums">
				{index + 1}
			</footer>
		</section>
	);
}
