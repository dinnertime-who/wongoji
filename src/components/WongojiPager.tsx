import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperClass } from "swiper/types";
import { Button } from "#/components/ui/button";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
} from "#/components/ui/pagination";
import type { Page } from "#/lib/wongoji";
import { WongojiSheet } from "./WongojiSheet";

import "swiper/css";

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
	 * PaginationLink는 <a>라서 이동이 아니라 슬라이드를 넘기는 여기에는 맞지 않는다.
	 */
	return (
		<Pagination className="no-print mt-4">
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

/**
 * 원고지를 한 장씩 넘겨 본다.
 *
 * 인쇄할 때는 슬라이더를 풀어 전 장이 세로로 이어지도록 styles.css에서 되돌린다.
 * Swiper가 wrapper에 인라인 transform을 걸기 때문에 `!important`로만 덮을 수 있다.
 */
export function WongojiPager({ pages }: { pages: Page[] }) {
	const [swiper, setSwiper] = useState<SwiperClass | null>(null);
	const [current, setCurrent] = useState(0);

	// 글을 지워 장이 줄면 없는 장에 남아 있을 수 있다
	useEffect(() => {
		if (current > pages.length - 1) {
			const last = Math.max(0, pages.length - 1);
			setCurrent(last);
			swiper?.slideTo(last);
		}
	}, [pages.length, current, swiper]);

	const goTo = (index: number) => {
		setCurrent(index);
		swiper?.slideTo(index);
	};

	return (
		<div>
			<Swiper
				modules={[Keyboard]}
				slidesPerView={1}
				spaceBetween={32}
				keyboard={{ enabled: true }}
				watchOverflow
				onSwiper={setSwiper}
				onSlideChange={(s) => setCurrent(s.activeIndex)}
				className="wongoji-pager w-full"
			>
				{pages.map((page, i) => (
					<SwiperSlide
						// biome-ignore lint/suspicious/noArrayIndexKey: 장은 순서가 곧 정체성이다. 몇째 장인지 말고는 구분할 것이 없다.
						key={i}
					>
						{/* 실물 200자 원고지가 174mm(약 660px)다. 그보다 조금 크게 둔다 */}
						<div className="mx-auto w-full max-w-4xl">
							<WongojiSheet page={page} index={i} />
						</div>
					</SwiperSlide>
				))}
			</Swiper>

			<PageNav total={pages.length} current={current} onSelect={goTo} />
		</div>
	);
}
