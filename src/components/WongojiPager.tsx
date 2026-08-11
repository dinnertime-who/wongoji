import { useEffect, useState } from "react";
import { Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperClass } from "swiper/types";
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

	return (
		<nav
			className="no-print mt-4 flex flex-wrap items-center justify-center gap-1 text-xs tabular-nums"
			aria-label="원고지 장 이동"
		>
			<button
				type="button"
				onClick={() => step(-1)}
				disabled={current === 0}
				className="rounded border border-[var(--hairline)] px-2 py-1 transition-colors hover:bg-[var(--paper)] disabled:opacity-30"
				aria-label="이전 장"
			>
				←
			</button>

			{pageItems(total, current).map((item, i) =>
				item === "gap" ? (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: 생략 기호는 위치 말고 구분할 것이 없다.
						key={`gap-${i}`}
						className="px-1 text-[var(--muted)]"
					>
						…
					</span>
				) : (
					<button
						key={item}
						type="button"
						onClick={() => onSelect(item)}
						aria-current={item === current ? "page" : undefined}
						className={`min-w-7 rounded border px-2 py-1 transition-colors ${
							item === current
								? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
								: "border-[var(--hairline)] hover:bg-[var(--paper)]"
						}`}
					>
						{item + 1}
					</button>
				),
			)}

			<button
				type="button"
				onClick={() => step(1)}
				disabled={current === total - 1}
				className="rounded border border-[var(--hairline)] px-2 py-1 transition-colors hover:bg-[var(--paper)] disabled:opacity-30"
				aria-label="다음 장"
			>
				→
			</button>
		</nav>
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
						<div className="mx-auto w-full max-w-3xl">
							<WongojiSheet page={page} index={i} />
						</div>
					</SwiperSlide>
				))}
			</Swiper>

			<PageNav total={pages.length} current={current} onSelect={goTo} />
		</div>
	);
}
