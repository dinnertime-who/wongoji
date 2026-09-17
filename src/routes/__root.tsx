import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { SaveStatusProvider } from "#/entities/archive";
import { FeatureAnnouncement } from "#/features/feature-announcement";
import { ImportPrompt } from "#/features/import-legacy";
import { FeedbackDialog } from "#/features/send-feedback";
import { QueryProvider } from "#/shared/api/query";
import { SessionProvider } from "#/shared/api/session";
import {
	SITE_DESCRIPTION,
	SITE_KEYWORDS,
	SITE_OG_IMAGE,
	SITE_SHARE_DESCRIPTION,
	SITE_TITLE,
	SITE_URL,
} from "#/shared/config/site";
import { Analytics } from "#/shared/ui/analytics";
import { Toaster } from "#/shared/ui/sonner";
import appCss from "../styles.css?url";
import { hideAnnouncement, loadAnnouncement } from "./-announcement";
import { type Boot, loadBoot } from "./-boot";
import { sendFeedback } from "./-feedback";

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

	/**
	 * 검색 엔진과 SNS가 이 서비스를 무엇으로 아는가.
	 *
	 * 공통 문구는 `shared/config/site`에 모여 있다. canonical과 구조화 데이터는
	 * 각 페이지를 설명하는 라우트에서 설정한다.
	 */
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			/*
			 * 브라우저가 제 껍데기(주소창·상태바)를 칠하는 색. **종이색과 같은
			 * 값이다** — 다른 색을 두면 설치해서 띄웠을 때 제목 표시줄만 띠처럼
			 * 남는다. `manifest`의 `theme_color`와 한 쌍이라 한쪽만 고치지 않는다.
			 */
			{ name: "theme-color", content: "#f4f2ec" },
			{
				title: SITE_TITLE,
			},
			{
				name: "description",
				content: SITE_DESCRIPTION,
			},
			{
				name: "keywords",
				content: SITE_KEYWORDS,
			},
			/*
			 * 링크를 나눌 때 딸려 가는 카드. og와 twitter를 둘 다 적는 이유는
			 * 읽는 쪽이 제각각이기 때문이다 — 카카오톡·페이스북은 og를 보고,
			 * 트위터는 twitter를 먼저 보고 없으면 og로 떨어진다.
			 */
			{ property: "og:type", content: "website" },
			{ property: "og:url", content: SITE_URL },
			{ property: "og:title", content: SITE_TITLE },
			{ property: "og:description", content: SITE_SHARE_DESCRIPTION },
			{ property: "og:image", content: SITE_OG_IMAGE },
			/*
			 * 규격을 함께 적는다. 스크래퍼가 그림을 받아 보기 전에 자리를 잡을
			 * 수 있어서, 처음 공유될 때 카드가 접혀 나오는 일이 줄어든다.
			 */
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{ property: "og:image:alt", content: SITE_SHARE_DESCRIPTION },
			{ property: "og:site_name", content: "원고지" },
			{ property: "og:locale", content: "ko_KR" },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: SITE_TITLE },
			{ name: "twitter:description", content: SITE_SHARE_DESCRIPTION },
			{ name: "twitter:image", content: SITE_OG_IMAGE },
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{ rel: "icon", href: "/favicon.ico", sizes: "any" },
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
			/*
			 * 설치할 수 있는 앱이라는 선언(`public/manifest.webmanifest`).
			 *
			 * **서비스 워커는 두지 않았다.** 크롬은 108(모바일)·112(데스크톱)부터
			 * 설치 메뉴를 여는 데 워커를 요구하지 않아서, 이 한 줄로 주소창의
			 * 설치 아이콘과 안드로이드의 "앱 설치"가 뜬다. 워커가 필요한 것은
			 * 오프라인이고 그것은 따로 할 일이다([docs/plan-offline.md]).
			 */
			{ rel: "manifest", href: "/manifest.webmanifest" },
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
					<Analytics />
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
							<FeatureAnnouncement
								load={loadAnnouncement}
								hide={hideAnnouncement}
							>
								{children}
							</FeatureAnnouncement>
							<FeedbackDialog send={sendFeedback} />
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
