import { createFileRoute, notFound } from "@tanstack/react-router";
import { GuideArticlePage, hasArticleBody } from "#/pages/guide";
import {
	ARTICLES,
	type Article,
	articleUrl,
	breadcrumb,
} from "#/shared/config/guide";

/**
 * 사용법 글 하나.
 *
 * 라우트를 글마다 두지 않고 하나로 둔 이유는 문서 머리가 전부 같은 자리에서
 * 나오기 때문이다 — 제목·설명·canonical이 `ARTICLES`의 한 줄에서 온다. 글을
 * 더할 때 라우트 파일을 새로 만들 일이 없다.
 */
function find(slug: string): Article {
	const article = ARTICLES.find((a) => a.slug === slug);
	/*
	 * 목록에 있어도 본문이 없으면 없는 쪽이다. 둘을 함께 보는 이유는 목록만
	 * 늘리고 본문을 안 쓴 채로 배포하면 **빈 쪽이 sitemap에 실려** 나가기
	 * 때문이다.
	 */
	if (!article || !hasArticleBody(slug)) throw notFound();
	return article;
}

export const Route = createFileRoute("/guide/$slug")({
	beforeLoad: ({ params }) => ({ article: find(params.slug) }),
	head: ({ params }) => {
		const article = ARTICLES.find((a) => a.slug === params.slug);
		if (!article) return {};
		return {
			meta: [
				{ title: `${article.title} | 원고지` },
				{ name: "description", content: article.description },
				{ property: "og:title", content: article.title },
				{ property: "og:description", content: article.description },
				{ property: "og:type", content: "article" },
				{ name: "twitter:title", content: article.title },
				{ name: "twitter:description", content: article.description },
				// 검색 결과에 `원고지 › 사용법 › 문장부호`로 보이는 자리
				{ "script:ld+json": breadcrumb(article) },
			],
			links: [{ rel: "canonical", href: articleUrl(article.slug) }],
		};
	},
	component: Screen,
});

function Screen() {
	const { article } = Route.useRouteContext();
	return <GuideArticlePage article={article} />;
}
