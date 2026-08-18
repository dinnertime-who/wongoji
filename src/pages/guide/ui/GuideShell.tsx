import { Link } from "@tanstack/react-router";
import { ARTICLES } from "#/shared/config/guide";
import { PageHeader } from "#/widgets/page-header";

/**
 * 사용법 글이 함께 입는 껍데기.
 *
 * 머리말은 원고 쪽과 같은 것을 쓴다(`sidebar={false}`) — 읽다가 로그인하거나
 * 원고로 건너가는 길이 늘 같은 자리에 있어야 한다.
 *
 * **본문 폭을 `max-w-3xl`로 묶는다.** 원고 쪽은 원고지를 나란히 두느라 넓지만
 * 이곳은 읽는 글이고, 한 줄이 길어지면 눈이 다음 줄 첫머리를 놓친다.
 */
export function GuideShell({
	title,
	lead,
	slug,
	children,
}: {
	title: string;
	/** 제목 아래 한 문단. 무엇을 답해 주는 글인지 */
	lead: string;
	/** 지금 이 글. 아래 목록에서 제 것을 뺀다. 목차 자신이면 없다 */
	slug?: string;
	children: React.ReactNode;
}) {
	const others = ARTICLES.filter((a) => a.slug !== slug);

	return (
		<>
			<PageHeader width="narrow" sidebar={false}>
				<nav className="flex min-w-0 items-center gap-2 text-xs">
					<Link
						to="/"
						className="shrink-0 text-muted-foreground hover:text-foreground"
					>
						원고지
					</Link>
					<span className="shrink-0 text-muted-foreground/50">/</span>
					{slug ? (
						<>
							<Link
								to="/guide"
								className="shrink-0 text-muted-foreground hover:text-foreground"
							>
								사용법
							</Link>
							<span className="shrink-0 text-muted-foreground/50">/</span>
							<span className="truncate">{title}</span>
						</>
					) : (
						<span className="truncate">사용법</span>
					)}
				</nav>
			</PageHeader>

			<div className="mx-auto w-full max-w-3xl px-6 pt-8 pb-16">
				<article>
					<h1 className="font-bold text-3xl leading-tight tracking-tight">
						{title}
					</h1>
					<p className="mt-3 text-base text-muted-foreground leading-7">
						{lead}
					</p>
					<div className="mt-8">{children}</div>
				</article>

				{/*
				 * 글 끝에서 앱으로 건너가는 길. 읽고 나면 해 보고 싶어지는 것이 이
				 * 글들의 목적이고, 로그인 없이 바로 써 볼 수 있다는 것을 여기서 처음
				 * 아는 사람이 있다.
				 */}
				<aside className="mt-14 rounded-lg border border-grid bg-[var(--paper)] p-6">
					<h2 className="font-semibold text-lg">직접 써 보기</h2>
					<p className="mt-2 text-muted-foreground text-sm leading-6">
						여기 적힌 규칙은 원고지가 글을 조판할 때 그대로 적용하는 것들입니다.
						글을 붙여 넣으면 200자 원고지에 옮겨진 모습과 매수가 바로 나옵니다.
						로그인 없이 쓸 수 있습니다.
					</p>
					<Link
						to="/"
						className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:opacity-90"
					>
						원고지 열기
					</Link>
				</aside>

				{others.length > 0 && (
					<nav className="mt-10 border-border border-t pt-8">
						<h2 className="font-semibold text-muted-foreground text-sm">
							다른 글
						</h2>
						<ul className="mt-4 space-y-4">
							{others.map((a) => (
								<li key={a.slug}>
									<Link
										to="/guide/$slug"
										params={{ slug: a.slug }}
										className="group block"
									>
										<span className="font-medium group-hover:underline">
											{a.label}
										</span>
										<span className="mt-0.5 block text-muted-foreground text-sm leading-6">
											{a.summary}
										</span>
									</Link>
								</li>
							))}
						</ul>
					</nav>
				)}
			</div>
		</>
	);
}
