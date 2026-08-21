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
import { FEATURES } from "#/shared/config/landing";
import {
	SITE_DESCRIPTION,
	SITE_KEYWORDS,
	SITE_OG_IMAGE,
	SITE_SHARE_DESCRIPTION,
	SITE_TITLE,
	SITE_URL,
} from "#/shared/config/site";
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

	/**
	 * 검색 엔진과 SNS가 이 서비스를 무엇으로 아는가.
	 *
	 * 문구는 `shared/config/site`에 모여 있다. canonical만 여기 없다 — 그것은
	 * "이 주소가 정본"이라는 선언이라 쪽마다 다르고, 색인되는 쪽(`index`)이
	 * 제 것을 얹는다.
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
			/*
			 * 구조화 데이터. **`<script>`를 손으로 끼우지 않는다** — 이 열쇠를
			 * 보면 라우터가 `application/ld+json`으로 찍어 준다(`HeadContent`).
			 * 직접 넣으면 하이드레이션 때 문서 머리가 어긋난다.
			 */
			{
				"script:ld+json": {
					"@context": "https://schema.org",
					"@type": "WebApplication",
					name: "원고지",
					/*
					 * 이 서비스를 부르는 다른 이름들. 사람마다 다른 말로 찾는데
					 * `name`은 하나뿐이라, 나머지를 여기 적는다.
					 */
					alternateName: [
						"온라인 원고지",
						"원고지 작성 사이트",
						"200자 원고지 조판 에디터",
					],
					url: SITE_URL,
					description: SITE_SHARE_DESCRIPTION,
					applicationCategory: "WritingApplication",
					/*
					 * **브라우저만 있으면 된다는 것을 기계에게도 말한다.** `원고지 작성
					 * 프로그램`으로 찾는 사람이 재는 것이 이것이고, 검색 결과에서
					 * "설치가 필요 없음"으로 읽히는 자리가 여기다.
					 */
					operatingSystem: "All",
					browserRequirements: "Requires JavaScript",
					isAccessibleForFree: true,
					inLanguage: "ko-KR",
					/*
					 * 화면에 적은 것과 같은 목록이다(`shared/config/landing`). 이름만
					 * 옮기고 설명은 두지 않는다 — schema.org의 `featureList`는 짧은
					 * 이름을 늘어놓는 자리다.
					 */
					featureList: FEATURES.map((f) => f.title),
					offers: {
						"@type": "Offer",
						price: "0",
						priceCurrency: "KRW",
					},
				},
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{ rel: "icon", href: "/favicon.ico", sizes: "any" },
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
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
