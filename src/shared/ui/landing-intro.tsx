import { Link } from "@tanstack/react-router";
import {
	FAQ,
	FEATURES,
	LANDING_HEADING,
	LANDING_LEAD,
} from "#/shared/config/landing";

/**
 * 원고지 아래에 두는 소개와 문답.
 *
 * **체험 원고 쪽에만 둔다** — 사용법 링크(`guide-footer`)와 같은 이유다. 계정
 * 쪽은 색인하지 않고, 제 원고를 쓰러 들어온 사람에게 서비스 소개를 다시 보일
 * 까닭도 없다.
 *
 * 여기 있는 글이 곧 이 쪽의 본문이다. 그 전까지 `/`에는 크롤러가 읽을 문장이
 * 없었다 — 빈 에디터의 안내문 한 줄과 격자뿐이라, "원고지 작성 사이트"로
 * 검색한 사람에게 걸릴 말이 메타 태그 바깥에는 하나도 없었다.
 *
 * **쪽의 `h1`이 여기 있다.** 위쪽은 제목을 적는 입력칸이라 heading이 될 수 없다
 * — 사람이 친 원고 제목이 쪽의 제목 노릇을 하면 검색 결과에 "제목 없음"이
 * 걸린다.
 */
export function LandingIntro() {
	return (
		<section
			aria-labelledby="landing-heading"
			className="border-border border-t"
		>
			<div className="mx-auto w-full max-w-6xl px-4 py-12">
				<h1
					id="landing-heading"
					className="font-bold text-2xl leading-tight tracking-tight"
				>
					{LANDING_HEADING}
				</h1>
				<p className="mt-3 max-w-2xl text-[0.95rem] text-muted-foreground leading-7">
					{LANDING_LEAD}
				</p>

				{/*
				 * 절 제목을 둔다. 없으면 기능 여섯이 저마다 `h2`가 되어 쪽의 뼈대가
				 * `h1` 하나에 `h2` 여덟인 모양이 된다 — 크롤러가 읽는 목차가 그것이라,
				 * 무엇이 절이고 무엇이 그 안의 항목인지 구분되지 않는다.
				 */}
				<h2 className="mt-12 font-semibold text-base">
					원고지로 할 수 있는 일
				</h2>
				<ul className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
					{FEATURES.map((f) => (
						<li key={f.title} className="min-w-0">
							<h3 className="font-semibold text-sm">{f.title}</h3>
							<p className="mt-1 text-muted-foreground text-xs leading-5">
								{f.body}
							</p>
						</li>
					))}
				</ul>

				<h2 className="mt-12 font-semibold text-base">자주 묻는 질문</h2>
				{/*
				 * `dl`로 적는다. 물음과 답이 짝이라는 것이 태그에 드러나야 하고,
				 * 접어 두지 않는다 — `details`로 감추면 사람은 눌러서 열 수 있지만
				 * 구조화 데이터가 가리키는 글이 처음에 보이지 않는 상태가 된다.
				 */}
				<dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
					{FAQ.map((item) => (
						<div key={item.q} className="min-w-0">
							<dt className="font-medium text-sm">{item.q}</dt>
							<dd className="mt-1 text-muted-foreground text-xs leading-5">
								{item.a}
							</dd>
						</div>
					))}
				</dl>

				{/*
				 * 문답 끝에서 사용법으로 건너가는 길. 마지막 물음이 "사용법도 볼 수
				 * 있나요"라 답 바로 뒤에 링크가 있어야 말이 맞는다.
				 */}
				<Link
					to="/guide"
					className="mt-8 inline-block text-muted-foreground text-xs underline decoration-dotted underline-offset-4 hover:text-foreground"
				>
					원고지 사용법 보기
				</Link>
			</div>
		</section>
	);
}
