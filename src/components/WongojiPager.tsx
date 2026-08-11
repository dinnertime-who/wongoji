import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import type { Page } from "#/lib/wongoji";
import { WongojiSheet } from "./WongojiSheet";

/**
 * 장 이동 막대.
 *
 * 번호를 다 늘어놓으면 장이 많아질수록 감당이 안 된다. PDF 미리보기처럼
 * `현재 / 총`으로 두고 현재 칸에 직접 적어 넣게 한다.
 */
function PageNav({
	total,
	current,
	onSelect,
}: {
	total: number;
	current: number;
	onSelect: (index: number) => void;
}) {
	// 타이핑 중에는 그대로 두어야 해서 입력값을 따로 붙든다. 비어 있으면 current를 쓴다.
	const [draft, setDraft] = useState<string | null>(null);

	if (total <= 1) return null;

	const step = (delta: number) =>
		onSelect(Math.min(total - 1, Math.max(0, current + delta)));

	const commit = () => {
		const wanted = Number(draft);
		setDraft(null);
		if (!Number.isFinite(wanted) || wanted < 1) return;
		onSelect(Math.min(total, Math.max(1, Math.round(wanted))) - 1);
	};

	return (
		<nav
			className="mt-2 flex shrink-0 items-center justify-center gap-1 text-xs tabular-nums"
			aria-label="원고지 장 이동"
		>
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={() => step(-1)}
				disabled={current === 0}
				aria-label="이전 장"
			>
				<ChevronLeftIcon />
			</Button>

			<Input
				value={draft ?? String(current + 1)}
				onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
				onFocus={(e) => e.currentTarget.select()}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === "Enter") e.currentTarget.blur();
					if (e.key === "Escape") {
						setDraft(null);
						e.currentTarget.blur();
					}
				}}
				inputMode="numeric"
				aria-label="현재 장"
				className="h-7 w-12 px-1 text-center text-xs tabular-nums"
			/>
			<span className="text-muted-foreground">/ {total}</span>

			<Button
				variant="ghost"
				size="icon-sm"
				onClick={() => step(1)}
				disabled={current === total - 1}
				aria-label="다음 장"
			>
				<ChevronRightIcon />
			</Button>
		</nav>
	);
}

/** 장 높이를 처음 어림잡는 값. 실측으로 곧 교정된다 */
const ESTIMATED_SHEET_HEIGHT = 560;

/**
 * 원고지를 세로로 이어 보여준다.
 *
 * 보이는 장과 그 앞뒤만 DOM에 둔다. 한 장이 200칸이라 장 수에 그대로 비례해서
 * 무거워지는데, 단편소설 한 편이 80장을 넘으면 16,000칸이 되어 화면이 멈춘다.
 * 창 렌더링으로 DOM에 남는 칸을 몇 장치로 붙들어 둔다.
 */
export function WongojiPager({ pages }: { pages: Page[] }) {
	const scrollRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: pages.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => ESTIMATED_SHEET_HEIGHT,
		overscan: 2,
	});

	/*
	 * 지금 보고 있는 장 — 맨 위에 걸친 장으로 센다.
	 *
	 * 번호를 누르면 그 장을 영역 맨 위에 붙이므로(align: start) 같은 기준으로 세야
	 * 누른 번호와 표시가 어긋나지 않는다.
	 *
	 * 다만 마지막 장은 스크롤이 더 내려갈 데가 없어 맨 위에 오지 못한다.
	 * 바닥에 닿으면 마지막 장으로 본다.
	 *
	 * 렌더 중에 virtualizer.scrollOffset을 읽으면 갱신 시점이 어긋나므로 스크롤
	 * 핸들러에서 번호만 붙든다. 장이 바뀔 때만 다시 그려진다.
	 */
	const [current, setCurrent] = useState(0);

	const trackCurrent = (el: HTMLDivElement) => {
		const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
		const next = atBottom
			? pages.length - 1
			: (virtualizer.getVirtualItemForOffset(el.scrollTop + 8)?.index ?? 0);
		if (next !== current) setCurrent(next);
	};

	const jumpTo = (index: number) => {
		setCurrent(index);
		virtualizer.scrollToIndex(index, { align: "start" });
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div
				ref={scrollRef}
				onScroll={(e) => trackCurrent(e.currentTarget)}
				className="min-h-0 flex-1 overflow-y-auto"
			>
				<div
					className="relative w-full"
					style={{ height: virtualizer.getTotalSize() }}
				>
					{virtualizer.getVirtualItems().map((item) => (
						<div
							key={item.key}
							data-index={item.index}
							// 장 높이는 화면 폭에 따라 변하므로 실측한다
							ref={virtualizer.measureElement}
							className="absolute top-0 left-0 w-full"
							style={{ transform: `translateY(${item.start}px)` }}
						>
							<div className="mx-auto w-full max-w-4xl pb-4">
								<WongojiSheet page={pages[item.index]} index={item.index} />
							</div>
						</div>
					))}
				</div>
			</div>

			<PageNav total={pages.length} current={current} onSelect={jumpTo} />
		</div>
	);
}
