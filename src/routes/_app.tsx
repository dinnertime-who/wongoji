import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { SaveStatusProvider, useSaveStatus } from "#/entities/archive";
import { tidy } from "#/features/archive-bootstrap";
import { requestPersistentStorage } from "#/shared/lib/storage";
import { SaveErrorBanner } from "#/shared/ui/save-error-banner";
import { AppShell } from "#/widgets/app-shell";
import { ManuscriptSidebar } from "#/widgets/manuscript-sidebar";

export const Route = createFileRoute("/_app")({ component: AppLayout });

/**
 * 보관함을 옆에 둔 쪽들이 함께 쓰는 껍데기.
 *
 * 주소에 나타나지 않는 레이아웃이다(`_app`). 원고 쪽과 폴더 쪽이 이 안에서
 * 갈리므로 **틀은 다시 마운트되지 않는다.**
 *
 * 전에는 각 쪽이 제 안에서 틀을 세웠다. 그래서 `/w/x`에서 `/f/y`로 옮기면 틀이
 * 통째로 갈리고, 보관함의 접힘 상태와 펼쳐 둔 폴더가 매번 초기화됐다 —
 * "어느 쪽을 보고 있든 보관함은 같은 자리에 같은 상태로 있어야 한다"고 적어
 * 두고서 그러지 못했다.
 */
function AppLayout() {
	return (
		<SaveStatusProvider>
			<AppShell sidebar={<ManuscriptSidebar />}>
				<Chrome />
			</AppShell>
		</SaveStatusProvider>
	);
}

function Chrome() {
	const { failure, backup } = useSaveStatus();

	/*
	 * 앱을 열 때 한 번. 어느 주소로 바로 들어와도 여기를 지난다.
	 *
	 * 기한 지난 휴지통 비우기 · 끊어진 경로 고치기 · 고아 본문 지우기.
	 * 전에는 두 쪽이 각자 이 effect를 들고 있었다.
	 */
	useEffect(() => {
		tidy();

		// 용량이 부족할 때 브라우저가 원고를 먼저 지우지 않게 요청한다.
		// 거절되어도 알리지 않는다 — 사용자가 할 수 있는 조치가 없다.
		void requestPersistentStorage();
	}, []);

	return (
		<>
			{failure && (
				<SaveErrorBanner failure={failure} onBackup={backup ?? undefined} />
			)}
			<Outlet />
		</>
	);
}
