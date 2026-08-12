import { useEffect, useState } from "react";
import { safeGetItem, savePreference } from "#/shared/lib/storage";
import { Sidebar, SidebarProvider } from "#/shared/ui/sidebar";

/** 화면 설정이라 원고와 무관하다. 보관함으로 옮기지 않는다 */
const SIDEBAR_KEY = "wongoji:sidebar";

/** 이 너비 아래에서는 보관함을 접은 채로 시작한다 */
const ROOMY = 1280;

/**
 * 보관함을 옆에 두는 틀.
 *
 * 무엇을 옆에 둘지는 **받아서** 쓴다. 안에서 직접 부르면 위젯이 위젯을 부르게
 * 되고, 그러면 이 틀은 보관함 없이는 쓸 수 없는 것이 된다. 회원 기능이 들어와
 * 옆에 다른 것이 붙어도 이 파일은 그대로다.
 */
export function AppShell({
	sidebar,
	children,
}: {
	sidebar: React.ReactNode;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);

	// localStorage는 브라우저에만 있으므로 마운트 후에 읽는다.
	useEffect(() => {
		const saved = safeGetItem(SIDEBAR_KEY);
		// 처음 오는 사람에게는 화면이 넉넉할 때만 펴 준다
		setOpen(saved === null ? window.innerWidth >= ROOMY : saved === "1");
	}, []);

	/*
	 * 접힘 상태는 이 앱의 다른 화면 설정과 같이 localStorage에 둔다. 정본은 쿠키에
	 * 적지만, 그러면 다른 화면 설정과 저장하는 곳이 갈린다.
	 *
	 * 실패해도 알리지 않는다. 접힘 상태를 못 적은 것은 다음에 열 때 기본값으로
	 * 시작한다는 뜻일 뿐인데, 원고 저장 실패와 같은 배너로 알리면 "원고를 잃을 수
	 * 있다"고 잘못 읽힌다.
	 */
	const change = (next: boolean) => {
		setOpen(next);
		savePreference(SIDEBAR_KEY, next ? "1" : "0");
	};

	return (
		/*
		 * 화면 높이에 못박는다. min-h로 두면 위쪽 한계가 없어 안쪽 스크롤 영역이
		 * 자기 높이를 정하지 못하고, 원고지가 길어질 때 페이지 전체가 늘어난다.
		 * 정본의 `min-h-svh`를 min-h-0으로 눌러야 그 못이 풀리지 않는다.
		 */
		<SidebarProvider
			open={open}
			onOpenChange={change}
			className="h-[100dvh] min-h-0 overflow-hidden bg-background text-foreground"
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
			<Sidebar>{sidebar}</Sidebar>

			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				{children}
			</div>
		</SidebarProvider>
	);
}
