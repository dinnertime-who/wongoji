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
			<ScrollAreaPrimitive.Viewport
				data-slot="scroll-area-viewport"
				className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
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
			className={cn(
				"flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
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
