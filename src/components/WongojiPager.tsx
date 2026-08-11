import { Keyboard, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Page } from "#/lib/wongoji";
import { WongojiSheet } from "./WongojiSheet";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

/**
 * 원고지를 한 장씩 넘겨 본다.
 *
 * 인쇄할 때는 슬라이더를 풀어 전 장이 세로로 이어지도록 styles.css에서 되돌린다.
 * Swiper가 wrapper에 인라인 transform을 걸기 때문에 `!important`로만 덮을 수 있다.
 */
export function WongojiPager({ pages }: { pages: Page[] }) {
	return (
		<Swiper
			modules={[Navigation, Pagination, Keyboard]}
			slidesPerView={1}
			spaceBetween={32}
			navigation
			keyboard={{ enabled: true }}
			pagination={{ clickable: true }}
			// 타이핑으로 장 수가 줄었을 때 빈 슬라이드에 남지 않도록
			watchOverflow
			className="wongoji-pager w-full pb-10"
		>
			{pages.map((page, i) => (
				<SwiperSlide
					// biome-ignore lint/suspicious/noArrayIndexKey: 장은 순서가 곧 정체성이다. 몇째 장인지 말고는 구분할 것이 없다.
					key={i}
				>
					<WongojiSheet page={page} index={i} />
				</SwiperSlide>
			))}
		</Swiper>
	);
}
