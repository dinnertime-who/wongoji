import { useEffect } from "react";
import { useSidebar } from "#/components/ui/sidebar";

/**
 * 손가락이 여기서 출발해야 보관함을 부르는 몸짓으로 친다.
 *
 * 화면 아무 데서나 받으면 본문을 만지는 손과 다툰다 — 에디터의 글자를 짚거나
 * 원고지를 가로로 미는 것이 전부 오른쪽으로 미는 몸짓이다.
 */
const EDGE = 40;

/** 이만큼 밀어야 연다. 짧게 스치는 것은 실수로 본다 */
const DISTANCE = 60;

/**
 * 세로보다 가로로 이만큼은 더 가야 한다.
 *
 * 비스듬히 내려긋는 것은 대개 세로로 넘기려던 것이다.
 */
const SLOPE = 1.5;

/**
 * 왼쪽 가장자리에서 오른쪽으로 밀면 보관함을 연다.
 *
 * 닫는 몸짓은 두지 않았다. 서랍은 바깥을 눌러 닫는 길이 이미 있고, 옆에 편
 * 보관함은 자리를 차지하지 않아 닫을 일이 드물다.
 *
 * 그리는 것이 없다. 창에 손을 얹어 두기만 한다.
 */
export function SidebarSwipe() {
	const { isMobile, open, openMobile, setOpen, setOpenMobile } = useSidebar();
	const closed = isMobile ? !openMobile : !open;

	useEffect(() => {
		// 열려 있으면 손을 뗀다. 여는 몸짓뿐이라 들을 것이 없다
		if (!closed) return;

		let from: { x: number; y: number } | null = null;

		const start = (e: TouchEvent) => {
			const touch = e.touches[0];
			// 손가락 두 개 이상은 확대하려는 것이다
			from =
				touch && e.touches.length === 1 && touch.clientX <= EDGE
					? { x: touch.clientX, y: touch.clientY }
					: null;
		};

		const end = (e: TouchEvent) => {
			const touch = e.changedTouches[0];
			const began = from;
			from = null;
			if (!began || !touch) return;

			const moved = touch.clientX - began.x;
			const strayed = Math.abs(touch.clientY - began.y);
			if (moved < DISTANCE || moved < strayed * SLOPE) return;

			if (isMobile) setOpenMobile(true);
			else setOpen(true);
		};

		const cancel = () => {
			from = null;
		};

		// 막는 것이 없으므로 passive로 둔다 — 스크롤이 걸리지 않는다
		const options = { passive: true } as const;
		window.addEventListener("touchstart", start, options);
		window.addEventListener("touchend", end, options);
		window.addEventListener("touchcancel", cancel, options);
		return () => {
			window.removeEventListener("touchstart", start);
			window.removeEventListener("touchend", end);
			window.removeEventListener("touchcancel", cancel);
		};
	}, [closed, isMobile, setOpen, setOpenMobile]);

	return null;
}
