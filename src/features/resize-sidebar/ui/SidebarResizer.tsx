import { useRef, useState } from "react";
import {
	clampWidth,
	SIDEBAR_DEFAULT,
	SIDEBAR_MAX,
	SIDEBAR_MIN,
} from "../model/width";

/** 키로 밀 때 한 번에 움직이는 폭 */
const STEP = 16;

/**
 * 보관함의 오른쪽 경계를 끌어 폭을 정한다.
 *
 * 보관함 안(`sidebar-inner`)에 얹지만 자리는 그 바깥 테두리에 잡는다 — 기준이 되는
 * 것은 `position: fixed`인 `sidebar-container`라, 따로 `relative`를 세우지 않아도
 * 된다. 절반을 밖으로 내밀어 경계 위에 걸치게 둔다.
 *
 * **좁은 화면에는 없다.** 거기서 보관함은 서랍이라 폭을 정할 것이 없고, 손가락에는
 * 6px짜리 경계를 겨눌 방법도 없다.
 *
 * 끌기만 두면 키보드로는 폭을 바꿀 길이 없다. ←/→로 한 칸씩 밀고 Home으로 되돌린다 —
 * 트리의 차례 바꾸기가 끌기와 메뉴를 함께 두는 것과 같은 짝이다.
 */
export function SidebarResizer({
	width,
	onWidth,
	onSettle,
	onDragging,
}: {
	width: number;
	/** 끄는 동안. 자주 불린다 */
	onWidth: (px: number) => void;
	/** 손을 뗐을 때. 저장은 여기서만 한다 */
	onSettle: (px: number) => void;
	/** 끄는 중인가. 그동안은 폭 애니메이션을 꺼야 손을 따라온다 */
	onDragging: (on: boolean) => void;
}) {
	const [dragging, setDragging] = useState(false);
	/*
	 * 시작점을 기억해 그로부터의 거리로 폭을 낸다. 매번 지금 폭에 delta를 더하면
	 * 접힌 만큼(clamp)이 사라져, 끝까지 밀었다 돌아올 때 손과 경계가 어긋난다.
	 *
	 * **끄는 중인지도 여기서 본다.** state로 가리면 `setDragging` 뒤 다시 그려지기
	 * 전에 들어온 움직임이 버려진다 — 손이 빠르면 그 사이에 여러 번 온다.
	 * state는 화면에 쓰는 것이고, 판단은 ref가 한다.
	 */
	const from = useRef<{ x: number; width: number } | null>(null);

	const settle = (px: number) => {
		onWidth(px);
		onSettle(px);
	};

	const widthAt = (clientX: number, start: { x: number; width: number }) =>
		clampWidth(start.width + clientX - start.x);

	const stop = (event: React.PointerEvent<HTMLHRElement>) => {
		const start = from.current;
		if (!start) return;
		from.current = null;
		// 취소가 먼저 와서 이미 놓았을 수 있다. 놓은 것을 또 놓으면 던진다
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		setDragging(false);
		onDragging(false);
		onSettle(widthAt(event.clientX, start));
	};

	return (
		/*
		 * `hr`인 것이 이상해 보이지만 이 자리에 맞는 유일한 원소다 — 암묵 role이
		 * `separator`이고, tabIndex를 주면 값(`aria-valuenow`)을 가질 수 있는
		 * 갈피가 된다. `button`으로 두면 "누르는 것"이라고 알리게 된다.
		 */
		<hr
			tabIndex={0}
			aria-orientation="vertical"
			aria-label="보관함 폭"
			aria-valuenow={width}
			aria-valuemin={SIDEBAR_MIN}
			aria-valuemax={SIDEBAR_MAX}
			data-dragging={dragging ? "" : undefined}
			onPointerDown={(event) => {
				// 가운데·오른쪽 단추로는 끌지 않는다
				if (event.button !== 0) return;
				event.preventDefault();
				event.currentTarget.setPointerCapture(event.pointerId);
				from.current = { x: event.clientX, width };
				setDragging(true);
				onDragging(true);
			}}
			onPointerMove={(event) => {
				if (from.current) onWidth(widthAt(event.clientX, from.current));
			}}
			onPointerUp={stop}
			onPointerCancel={stop}
			// 되돌리는 길. 끝까지 밀어 놓고 원래 폭을 더듬어 찾지 않게 한다
			onDoubleClick={() => settle(SIDEBAR_DEFAULT)}
			onKeyDown={(event) => {
				if (event.key === "ArrowLeft") settle(clampWidth(width - STEP));
				else if (event.key === "ArrowRight") settle(clampWidth(width + STEP));
				else if (event.key === "Home") settle(SIDEBAR_DEFAULT);
				else return;
				event.preventDefault();
			}}
			/*
			 * 잡는 자리는 6px이되 눈에 보이는 것은 실 한 오라기다. 평소에는 그것마저
			 * 감추고 손이 닿거나 포커스가 왔을 때만 드러낸다 — 늘 그어져 있으면
			 * 보관함 테두리가 두 겹이 된다.
			 *
			 * `h-auto`가 있어야 세로로 늘어난다. tailwind의 preflight가 `hr`에
			 * `height: 0`을 박아 두어서, 그것을 풀지 않으면 `inset-y-0`이 붙어 있어도
			 * 높이가 0인 채로 남아 **아무 데서도 잡히지 않는다.**
			 */
			className="absolute inset-y-0 right-0 z-20 m-0 hidden h-auto w-1.5 translate-x-1/2 cursor-col-resize touch-none select-none border-0 after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors focus-visible:outline-none focus-visible:after:bg-sidebar-ring hover:after:bg-sidebar-ring data-dragging:after:bg-sidebar-ring lg:block"
		/>
	);
}
