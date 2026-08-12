import { useEffect, useState } from "react";
import { ManuscriptSidebar } from "#/components/ManuscriptSidebar";
import {
	type SaveResult,
	type StoreIndex,
	safeGetItem,
	safeSetItem,
} from "#/lib/store";
import { Sidebar, SidebarProvider } from "#/shared/ui/sidebar";

/** 화면 설정이라 원고와 무관하다. 보관함으로 옮기지 않는다 */
const SIDEBAR_KEY = "wongoji:sidebar";

/** 이 너비 아래에서는 보관함을 접은 채로 시작한다 */
const ROOMY = 1280;

/**
 * 보관함을 옆에 두는 틀.
 *
 * 원고 쪽과 폴더 쪽이 함께 쓴다. 어느 쪽을 보고 있든 보관함은 같은 자리에
 * 같은 상태로 있어야 한다 — 쪽을 옮길 때마다 접혔다 펴지면 옮겨 다닐 수 없다.
 */
export function Shell({
	index,
	currentDocId,
	currentFolderId,
	onReport,
	onReset,
	children,
}: {
	index: StoreIndex;
	/** 지금 열어 둔 원고. 폴더 쪽에는 없다 */
	currentDocId: string;
	/** 지금 열어 둔 폴더. 원고 쪽에는 없다 */
	currentFolderId?: string;
	onReport: (result: SaveResult) => void;
	/**
	 * 하나뿐인 원고를 비운다.
	 *
	 * 비우는 방법이 쪽마다 다르다. 원고 쪽은 에디터가 들고 있는 내용까지 함께
	 * 갈아야 하고, 폴더 쪽은 에디터가 없어 저장소만 고치면 된다.
	 */
	onReset: (docId: string) => void;
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
	 * 적지만, 그러면 저장이 실패해도 알릴 길이 없다.
	 */
	const change = (next: boolean) => {
		setOpen(next);
		onReport(safeSetItem(SIDEBAR_KEY, next ? "1" : "0"));
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
			<Sidebar>
				<ManuscriptSidebar
					index={index}
					currentDocId={currentDocId}
					currentFolderId={currentFolderId}
					onReport={onReport}
					onReset={onReset}
				/>
			</Sidebar>

			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				{children}
			</div>
		</SidebarProvider>
	);
}
