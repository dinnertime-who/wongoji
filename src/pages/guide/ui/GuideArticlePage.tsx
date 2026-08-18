import type { Article } from "#/shared/config/guide";
import { ContestArticle } from "./ContestArticle";
import { GuideShell } from "./GuideShell";
import { LineBreaksArticle } from "./LineBreaksArticle";
import { PunctuationArticle } from "./PunctuationArticle";
import { RulesArticle } from "./RulesArticle";

/**
 * 글 하나를 그린다.
 *
 * 라우트가 slug로 글을 찾아 넘긴다 — 쪽은 주소를 몰라야 하므로 여기서 찾지
 * 않는다. 어느 slug에 어느 본문인지는 이 표 하나에만 있다.
 */
const BODIES: Record<string, () => React.ReactElement> = {
	rules: RulesArticle,
	"line-breaks": LineBreaksArticle,
	punctuation: PunctuationArticle,
	contest: ContestArticle,
};

/** 본문이 있는 slug인가. 라우트가 404를 가르는 데 쓴다 */
export function hasArticleBody(slug: string): boolean {
	return slug in BODIES;
}

export function GuideArticlePage({ article }: { article: Article }) {
	const Body = BODIES[article.slug];
	if (!Body) return null;

	return (
		<GuideShell
			title={article.label}
			lead={article.summary}
			slug={article.slug}
		>
			<Body />
		</GuideShell>
	);
}
