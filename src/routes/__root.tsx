import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { SaveStatusProvider } from "#/entities/archive";
import { ImportPrompt } from "#/features/import-legacy";
import { QueryProvider } from "#/shared/api/query";
import { Toaster } from "#/shared/ui/sonner";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
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
	return (
		<html lang="ko">
			<head>
				<HeadContent />
			</head>
			<body>
				<QueryProvider>
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
				{/*
				 * TanStack Devtools는 띄우지 않는다. 떠 있는 뱃지가 화면 구석을 가린다.
				 * 패키지와 vite 플러그인은 그대로 두었으니 다시 쓰려면 여기에 붙이면 된다.
				 */}
				<Scripts />
			</body>
		</html>
	);
}
