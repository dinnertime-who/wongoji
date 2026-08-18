import { Link } from "@tanstack/react-router";
import { ARTICLES } from "#/shared/config/guide";
import { GuideShell } from "./GuideShell";

/**
 * 사용법 목차.
 *
 * 여기서 갈라지는 넷은 서로 다른 질문에 답한다. 한 쪽에 몰아 두지 않은 이유가
 * `shared/config/guide.ts`에 적혀 있다.
 */
export function GuideIndexPage() {
	return (
		<GuideShell
			title="원고지 사용법"
			lead="200자 원고지에 글을 쓸 때 필요한 규칙을 네 갈래로 나눠 정리했습니다. 원고지 사용법에는 공인된 표준이 없어서, 자료마다 갈리는 대목은 갈린다고 밝히고 무엇을 기준으로 삼았는지 적었습니다."
		>
			<ul className="space-y-1">
				{ARTICLES.map((a) => (
					<li key={a.slug}>
						<Link
							to="/guide/$slug"
							params={{ slug: a.slug }}
							className="-mx-4 block rounded-lg px-4 py-4 hover:bg-muted"
						>
							<h2 className="font-semibold text-lg tracking-tight">
								{a.label}
							</h2>
							<p className="mt-1 text-[0.95rem] text-muted-foreground leading-7">
								{a.summary}
							</p>
						</Link>
					</li>
				))}
			</ul>
		</GuideShell>
	);
}
