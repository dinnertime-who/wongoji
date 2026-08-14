import { createFileRoute, redirect } from "@tanstack/react-router";
import { LegacyNotice } from "#/features/import-legacy";
import { EditorPage } from "#/pages/editor";
import { HomePage } from "#/pages/home";
import { pickEntry } from "./-boot";

export const Route = createFileRoute("/")({
	/**
	 * 어디로 갈지 **서버가 정한다.**
	 *
	 * 로그인한 사람은 여기까지 오지 않는다 — `throw redirect`가 SSR에서 진짜
	 * 302가 되므로, 브라우저는 이 쪽의 JS를 받지도 않고 곧장 제 원고로 간다.
	 *
	 * 전에는 이 판단이 화면 안에 있었고, 그동안 `null`을 그렸다. 세션을 기다려
	 * 한 번, 색인을 기다려 또 한 번 — 그 두 국면이 이 앱에서 가장 오래 비어 있는
	 * 자리였다.
	 */
	beforeLoad: async () => {
		const entry = await pickEntry();
		if (entry.kind === "doc") {
			throw redirect({
				to: "/w/$docId",
				params: { docId: entry.docId },
				replace: true,
			});
		}
		return { entry };
	},
	component: Screen,
});

/**
 * 로그인 여부로 갈리는 유일한 자리.
 *
 * - **비로그인** — 원고 한 편을 그대로 연다. 보관함도 사이드바도 없다. 원고지가
 *   어떻게 조판되는지 보러 온 사람이 계정부터 만들 이유가 없다
 * - **로그인** — 위에서 이미 제 원고로 보냈다. 여기 남는 것은 보관함이 빈
 *   경우뿐이고, 그때는 원고 하나를 만들어 연다
 *
 * 갈림을 라우트에 둔 이유는 쪽(page)끼리 서로를 부를 수 없기 때문이다. 주소를
 * 아는 자리가 여기뿐이라 고르는 일도 여기 있다.
 */
function Screen() {
	const { entry } = Route.useRouteContext();

	if (entry.kind === "empty") return <HomePage />;

	return (
		<>
			{/* 옛 원고가 남아 있으면 알린다. 없으면 아무것도 그리지 않는다 */}
			<LegacyNotice />
			<EditorPage docId={null} />
		</>
	);
}
