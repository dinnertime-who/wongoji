import { Link } from "@tanstack/react-router";
import { ARTICLES } from "#/shared/config/guide";

/**
 * 원고지 아래에 두는 사용법 링크.
 *
 * **체험 원고 쪽에만 둔다.** 계정 쪽은 색인하지 않고, 무엇보다 원고를 쓰는
 * 내내 띄워 두는 화면에 읽을거리 목록이 붙어 있을 이유가 없다.
 *
 * 여기 있어야 하는 이유가 둘이다. 크롤러가 `/`에서 링크를 타야 사용법 쪽에
 * 닿고 — sitemap만으로는 닿기는 해도 무게가 실리지 않는다 — 규칙이 궁금해서
 * 온 사람이 조판된 화면 바로 아래에서 답을 찾는다.
 */
export function GuideFooter() {
	return (
		<footer className="border-border border-t">
			<div className="mx-auto w-full max-w-6xl px-4 py-8">
				<h2 className="font-semibold text-muted-foreground text-xs">
					원고지 사용법
				</h2>
				<ul className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
					{ARTICLES.map((a) => (
						<li key={a.slug} className="min-w-0">
							<Link
								to="/guide/$slug"
								params={{ slug: a.slug }}
								className="group block"
							>
								<span className="font-medium text-sm group-hover:underline">
									{a.label}
								</span>
								<span className="mt-0.5 block text-muted-foreground text-xs leading-5">
									{a.summary}
								</span>
							</Link>
						</li>
					))}
				</ul>
				<Link
					to="/guide"
					className="mt-5 inline-block text-muted-foreground text-xs underline decoration-dotted underline-offset-4 hover:text-foreground"
				>
					사용법 전체 보기
				</Link>
			</div>
		</footer>
	);
}
