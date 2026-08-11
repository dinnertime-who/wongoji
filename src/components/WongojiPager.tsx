import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
} from "#/components/ui/pagination";
import type { Page } from "#/lib/wongoji";
import { WongojiSheet } from "./WongojiSheet";

/**
 * 장이 많아지면 점을 하나씩 세는 것보다 번호를 직접 누르는 편이 빠르다.
 * 장이 많을 때는 처음·끝·현재 주변만 남기고 나머지는 생략한다.
 */
function pageItems(total: number, current: number): (number | "gap")[] {
	if (total <= 7) return Array.from({ length: total }, (_, i) => i);

	const kept = new Set<number>([0, total - 1]);
	for (let i = current - 1; i <= current + 1; i++) {
		if (i >= 0 && i < total) kept.add(i);
	}

	const sorted = [...kept].sort((a, b) => a - b);
	const out: (number | "gap")[] = [];
	for (const [i, n] of sorted.entries()) {
		if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
		out.push(n);
	}
	return out;
}

function PageNav({
	total,
	current,
	onSelect,
}: {
	total: number;
	current: number;
	onSelect: (index: number) => void;
}) {
	if (total <= 1) return null;

	const step = (delta: number) =>
		onSelect(Math.min(total - 1, Math.max(0, current + delta)));

	/*
	 * shadcn Pagination의 구조만 쓰고 항목은 Button으로 둔다.
	 * PaginationLink는 <a>라서 이동이 아니라 스크롤을 옮기는 여기에는 맞지 않는다.
	 */
	return (
		<Pagination className="mt-2 shrink-0">
			<PaginationContent className="tabular-nums">
				<PaginationItem>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => step(-1)}
						disabled={current === 0}
						aria-label="이전 장"
					>
						<ChevronLeftIcon />
					</Button>
				</PaginationItem>

				{pageItems(total, current).map((item, i) =>
					item === "gap" ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: 생략 기호는 위치 말고 구분할 것이 없다.
						<PaginationItem key={`gap-${i}`}>
							<PaginationEllipsis />
						</PaginationItem>
					) : (
						<PaginationItem key={item}>
							<Button
								variant={item === current ? "default" : "ghost"}
								size="icon-sm"
								onClick={() => onSelect(item)}
								aria-current={item === current ? "page" : undefined}
							>
								{item + 1}
							</Button>
						</PaginationItem>
					),
				)}

				<PaginationItem>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => step(1)}
						disabled={current === total - 1}
						aria-label="다음 장"
					>
						<ChevronRightIcon />
					</Button>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
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
