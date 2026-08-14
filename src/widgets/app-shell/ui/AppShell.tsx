import { useEffect, useState } from "react";
import {
	clampWidth,
	SIDEBAR_DEFAULT,
	SidebarResizer,
} from "#/features/resize-sidebar";
import { type Panel, writePanel } from "#/shared/lib/panel";
import { safeGetItem, safeRemoveItem } from "#/shared/lib/storage";
import { Sidebar, SidebarProvider } from "#/shared/ui/sidebar";

/** 이 너비 아래에서는 보관함을 접은 채로 시작한다 */
const ROOMY = 1280;

/** 쿠키로 옮기기 전에 쓰던 자리. 처음 한 번만 들여다보고 비운다 */
const OLD_OPEN = "wongoji:sidebar";
const OLD_WIDTH = "wongoji:sidebarWidth";

/**
 * 끄는 동안 폭 애니메이션을 끈다.
 *
 * 정본은 자리 잡는 칸(`sidebar-gap`)과 실제로 보이는 칸(`sidebar-container`) 양쪽에
 * `transition-[width] duration-200`을 걸어 둔다. 접었다 펼 때는 그것이 맞지만, 끄는
 * 동안에는 경계가 손을 200ms 뒤따라와 고무줄처럼 보인다. 두 칸 다 정본이 만든 것이라
 * 바깥에서 클래스를 얹을 자리가 없어 `data-slot`으로 짚는다.
 */
const SMOOTH_OFF =
	"cursor-col-resize select-none [&_[data-slot=sidebar-container]]:transition-none [&_[data-slot=sidebar-gap]]:transition-none";

/**
 * 보관함을 옆에 두는 틀.
 *
 * 무엇을 옆에 둘지는 **받아서** 쓴다. 안에서 직접 부르면 위젯이 위젯을 부르게
 * 되고, 그러면 이 틀은 보관함 없이는 쓸 수 없는 것이 된다. 회원 기능이 들어와
 * 옆에 다른 것이 붙어도 이 파일은 그대로다.
 *
 * 폭을 정하는 손잡이도 여기서 그린다 — 보관함이 아니라 **틀의 일**이라, 옆에 붙는
 * 것이 무엇으로 바뀌어도 폭은 같은 자리에서 정해진다.
 *
 * ---
 *
 * **접힘과 폭은 서버가 읽어서 넘겨준다**(`panel`). 전에는 localStorage에 있어서
 * 서버가 볼 수 없었고, 그래서 첫 HTML은 늘 접힌 채로 나갔다가 하이드레이션이
 * 끝나야 제 폭으로 벌어졌다 — 열 때마다 한 번씩 덜컥거렸다. 쿠키로 옮기면서
 * 서버가 그리는 것과 브라우저가 그리는 첫 그림이 같아졌다.
 */
export function AppShell({
	panel,
	sidebar,
	children,
}: {
	/** 서버가 쿠키에서 읽어 온 것. 적힌 적 없으면 둘 다 null이다 */
	panel: Panel;
	sidebar: React.ReactNode;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(panel.open ?? false);
	const [width, setWidth] = useState(panel.width ?? SIDEBAR_DEFAULT);
	const [dragging, setDragging] = useState(false);

	/*
	 * 처음 오는 사람만 여기를 지난다.
	 *
	 * 쿠키가 없으면 서버는 접힌 채로 그릴 수밖에 없다 — 화면이 넓은지 좁은지는
	 * 브라우저만 안다. 그래서 **한 번만** 여기서 정하고 쿠키에 적어 둔다. 다음
	 * 방문부터는 서버가 처음부터 제대로 그린다.
	 *
	 * localStorage에 두던 시절의 값이 남아 있으면 그것을 먼저 따른다. 접어 두고
	 * 쓰던 사람의 화면이 어느 날 갑자기 펴져 있으면 그것도 고장으로 보인다.
	 */
	useEffect(() => {
		if (panel.open !== null && panel.width !== null) return;

		const wasOpen = safeGetItem(OLD_OPEN);
		const wasWide = Number(safeGetItem(OLD_WIDTH));
		const next = {
			open:
				panel.open ??
				(wasOpen === null ? window.innerWidth >= ROOMY : wasOpen === "1"),
			width:
				panel.width ??
				(Number.isFinite(wasWide) && wasWide > 0
					? clampWidth(wasWide)
					: SIDEBAR_DEFAULT),
		};

		setOpen(next.open);
		setWidth(next.width);
		writePanel(next);
		// 옮겨 담았으니 옛 자리는 비운다. 두 곳에 같은 값이 남아 있으면 언젠가 갈린다
		safeRemoveItem(OLD_OPEN);
		safeRemoveItem(OLD_WIDTH);
	}, [panel.open, panel.width]);

	/*
	 * 실패해도 알리지 않는다. 접힘 상태를 못 적은 것은 다음에 열 때 기본값으로
	 * 시작한다는 뜻일 뿐인데, 원고 저장 실패와 같은 배너로 알리면 "원고를 잃을 수
	 * 있다"고 잘못 읽힌다.
	 */
	const change = (next: boolean) => {
		setOpen(next);
		writePanel({ open: next, width });
	};

	const settle = (px: number) => writePanel({ open, width: px });

	return (
		/*
		 * 화면 높이에 못박는다. min-h로 두면 위쪽 한계가 없어 안쪽 스크롤 영역이
		 * 자기 높이를 정하지 못하고, 원고지가 길어질 때 페이지 전체가 늘어난다.
		 * 정본의 `min-h-svh`를 min-h-0으로 눌러야 그 못이 풀리지 않는다.
		 */
		<SidebarProvider
			open={open}
			onOpenChange={change}
			/*
			 * 폭은 정본이 래퍼에 꽂는 CSS 변수 하나로 정해진다. `...style`이 뒤에
			 * 오므로 여기서 넘긴 값이 이긴다 — 덕분에 `shared/ui/sidebar.tsx`는
			 * shadcn 원본 그대로 둘 수 있다.
			 */
			style={{ "--sidebar-width": `${width}px` } as React.CSSProperties}
			className={`h-[100dvh] min-h-0 overflow-hidden bg-background text-foreground ${
				dragging ? SMOOTH_OFF : ""
			}`}
		>
			{/*
			 * 보관함은 가운데 정렬된 본문 바깥에 둔다. 안에 넣으면 원고 폭을 깎는다.
			 *
			 * 한 벌만 쓴다. 넓으면 옆에 붙고 좁으면 서랍이 되는 분기는 Sidebar가 안에서
			 * 가른다.
			 *
			 * 접어도 DOM에는 남는다. 폭을 0으로 미끄러뜨려 접는 그림을 얻으려면
			 * 그려 두어야 한다.
			 */}
			<Sidebar>
				{sidebar}
				{/* 접혀 있으면 경계도 화면 밖이라 잡을 것이 없다 */}
				{open && (
					<SidebarResizer
						width={width}
						onWidth={setWidth}
						onSettle={settle}
						onDragging={setDragging}
					/>
				)}
			</Sidebar>

			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				{children}
			</div>
		</SidebarProvider>
	);
}
