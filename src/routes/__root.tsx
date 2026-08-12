import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useArchiveScope } from "#/features/auth";
import { QueryProvider } from "#/shared/api/query";

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
					<ArchiveScope>{children}</ArchiveScope>
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

/**
 * 보관함 칸을 세션에 맞춘다.
 *
 * QueryProvider 안이어야 한다 — 세션을 묻는 일도 질의다. 그리는 것은 없다.
 */
function ArchiveScope({ children }: { children: React.ReactNode }) {
	useArchiveScope();
	return children;
}
