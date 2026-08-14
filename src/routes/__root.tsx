import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { SaveStatusProvider } from "#/entities/archive";
import { ImportPrompt } from "#/features/import-legacy";
import { QueryProvider } from "#/shared/api/query";
import { SessionProvider } from "#/shared/api/session";
import { Toaster } from "#/shared/ui/sonner";
import appCss from "../styles.css?url";
import { type Boot, loadBoot } from "./-boot";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	/**
	 * 누가 보고 있고 보관함을 어떻게 두었는가.
	 *
	 * **여기서 한 번 뜨고 첫 HTML에 실어 보낸다.** 전에는 브라우저가 하이드레이션
	 * 한 뒤에 물었고, 그 답을 기다리는 동안 화면이 비어 있었다.
	 *
	 * `staleTime: Infinity`라 쪽을 옮겨 다녀도 다시 묻지 않는다. 로그인·로그아웃은
	 * 주소를 통째로 다시 부르는 일이라 그때 새로 뜬다.
	 */
	loader: (): Promise<Boot> => loadBoot(),
	staleTime: Number.POSITIVE_INFINITY,

	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "200자 원고지",
			},
			{
				name: "description",
				content: "글을 200자 원고지 규칙에 맞춰 조판해 주는 에디터",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	/*
	 * 서버가 뜬 것. 첫 렌더부터 손에 쥐고 있으므로 아래 어느 것도 "아직 모른다"를
	 * 그리지 않는다.
	 */
	const { user } = Route.useLoaderData();
	const { queryClient } = Route.useRouteContext();

	return (
		<html lang="ko">
			<head>
				<HeadContent />
			</head>
			<body>
				<SessionProvider user={user}>
					<QueryProvider client={queryClient}>
						{/*
						 * 저장 실패를 알리는 창구. **`_app`이 아니라 여기다** — 홈에서도
						 * 보관함을 고친다(첫 원고를 만든다). 배너를 그리는 자리는 여전히
						 * `_app` 안이고, 이것은 그 값을 나르는 통로일 뿐이다.
						 */}
						<SaveStatusProvider>
							{/*
							 * 옛 원고를 옮길지 묻는 창. 어느 쪽에서 로그인하든 떠야 해서
							 * root에 둔다. 전과 달리 이것을 답하기를 기다리는 화면은 없다 —
							 * 보관함이 서버 하나가 되면서 붙들 것이 없어졌다.
							 */}
							<ImportPrompt />
							{children}
							{/*
							 * 스쳐 가는 알림. **원고를 잃을 수 있는 실패는 여기로 오지
							 * 않는다** — 그런 것은 사라지지 않는 배너가 받는다.
							 */}
							<Toaster position="bottom-center" />
						</SaveStatusProvider>
					</QueryProvider>
				</SessionProvider>
				{/*
				 * TanStack Devtools는 띄우지 않는다. 떠 있는 뱃지가 화면 구석을 가린다.
				 * 패키지와 vite 플러그인은 그대로 두었으니 다시 쓰려면 여기에 붙이면 된다.
				 */}
				<Scripts />
			</body>
		</html>
	);
}
