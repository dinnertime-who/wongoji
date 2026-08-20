import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/shared/lib/utils";

/**
 * 정본에서 한 곳 고쳤다 — **어느 쪽으로 스크롤하는지를 prop으로 받는다.**
 *
 * 정본은 세로 스크롤바만 제 안에서 그리고, 가로가 필요하면 `<ScrollBar
 * orientation="horizontal" />`을 children으로 넘기라고 한다. 그런데 이 부품은
 * children을 **Viewport 안에** 넣으므로, 그렇게 넘긴 스크롤바는 스크롤되는 내용
 * 속으로 들어간다. Radix가 요구하는 자리는 Viewport의 **형제**다.
 *
 * 그 자리에서는 스크롤바가 아예 뜨지 않았다 — forceMount로만 나타났다. 넘침을
 * 재는 쪽과 그리는 쪽이 어긋나 있었던 것이다.
 */
function ScrollArea({
	className,
	children,
	orientation = "vertical",
	...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
	/** `both`는 두 방향 다 그린다 */
	orientation?: "vertical" | "horizontal" | "both";
}) {
	return (
		<ScrollAreaPrimitive.Root
			data-slot="scroll-area"
			className={cn("relative", className)}
			{...props}
		>
			{/*
			 * 정본에서 고친 둘째 — **안쪽 겹을 `display: table`에서 내린다.**
			 *
			 * Radix는 Viewport 안에 겹을 하나 더 두고 인라인 스타일로 `display: table;
			 * min-width: 100%`을 박는다. 표는 제 내용만큼 벌어지는 상자라, 그 안에
			 * 넓은 것이 하나 있으면 **칸이 창보다 넓어진다** — 서재에서 잔디가
			 * 747px이면 `max-w-3xl`로 묶어 둔 본문까지 747px이 되어 좁은 화면에서
			 * 쪽 전체가 가로로 밀렸다. 제목도 목록도 함께 밀린다.
			 *
			 * 인라인 스타일이라 `!`를 붙여야 이긴다. block으로 내려도 넘치는 것은
			 * 그대로 넘쳐서(가로 잔디) 스크롤은 살아 있다 — 다만 그 넓이가 바깥
			 * 칸의 폭을 정하지 못한다.
			 */}
			<ScrollAreaPrimitive.Viewport
				data-slot="scroll-area-viewport"
				className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 [&>div]:block!"
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			{orientation !== "horizontal" && <ScrollBar orientation="vertical" />}
			{orientation !== "vertical" && <ScrollBar orientation="horizontal" />}
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

function ScrollBar({
	className,
	orientation = "vertical",
	...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
	return (
		<ScrollAreaPrimitive.ScrollAreaScrollbar
			data-slot="scroll-area-scrollbar"
			data-orientation={orientation}
			orientation={orientation}
			/*
			 * 정본보다 얇다(2.5 → 1.5). 이 앱에서 스크롤바가 붙는 곳은 잔디 격자인데,
			 * 정본 두께가 잔디 한 칸과 같은 10px이라 **여덟 번째 요일 줄처럼 보였다.**
			 * 종이 위에 머리카락 선을 긋는 팔레트라 스크롤바도 그만큼 가늘어야 한다.
			 */
			className={cn(
				"flex touch-none p-px transition-colors select-none data-horizontal:h-1.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-1.5 data-vertical:border-l data-vertical:border-l-transparent",
				className,
			)}
			{...props}
		>
			<ScrollAreaPrimitive.ScrollAreaThumb
				data-slot="scroll-area-thumb"
				className="relative flex-1 rounded-full bg-border"
			/>
		</ScrollAreaPrimitive.ScrollAreaScrollbar>
	);
}

export { ScrollArea, ScrollBar };
