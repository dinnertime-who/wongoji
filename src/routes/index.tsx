import { createFileRoute, redirect } from "@tanstack/react-router";
import { LegacyNotice } from "#/features/import-legacy";
import { EditorPage } from "#/pages/editor";
import { HomePage } from "#/pages/home";
import { FAQ } from "#/shared/config/landing";
import { SITE_URL } from "#/shared/config/site";
import { pickEntry } from "./-boot";

export const Route = createFileRoute("/")({
	/**
	 * 어디로 갈지 **서버가 정한다.**
	 *
	 * 로그인한 사람은 여기까지 오지 않는다 — `throw redirect`가 SSR에서 진짜
	 * 302가 되므로, 브라우저는 이 쪽의 JS를 받지도 않고 곧장 서재로 간다.
	 *
	 * 전에는 이 판단이 화면 안에 있었고, 그동안 `null`을 그렸다. 세션을 기다려
	 * 한 번, 색인을 기다려 또 한 번 — 그 두 국면이 이 앱에서 가장 오래 비어 있는
	 * 자리였다.
	 */
	beforeLoad: async () => {
		const entry = await pickEntry();
		if (entry.kind === "library") {
			throw redirect({ to: "/library", replace: true });
		}
		return { entry };
	},
	/**
	 * **색인되는 쪽은 여기 하나다.**
	 *
	 * canonical을 `__root`가 아니라 이 쪽에 두는 이유가 있다. 루트에 두면 계정
	 * 쪽(`_app`)까지 "정본은 홈이다"라고 말하게 되는데, 그 쪽들은 동시에
	 * `noindex`다. **색인하지 말라는 쪽이 홈을 제 정본으로 가리키면** 구글이 그
	 * 지시를 홈으로 옮겨 읽어 홈까지 색인에서 뺄 수 있다.
	 */
	head: () => ({
		links: [{ rel: "canonical", href: SITE_URL }],
		meta: [
			/*
			 * 쪽 아래 문답을 기계에게도 읽힌다.
			 *
			 * **구조화 데이터는 쪽에 실제로 보이는 글과 같아야 한다.** 그래서 화면과
			 * 여기가 같은 배열(`shared/config/landing`의 `FAQ`)을 읽는다 — 따로
			 * 적어 두면 한쪽만 고쳤을 때 규정을 어기게 되고, 그것을 알게 되는 것은
			 * 서치 콘솔에 경고가 뜨는 몇 주 뒤다.
			 *
			 * `_app`이 아니라 여기 두는 이유는 canonical과 같다 — 문답이 실제로
			 * 그려지는 쪽이 `/` 하나이기 때문이다.
			 */
			/*
			 * **색인해도 되는 쪽이라고 적어 둔다.** 적지 않아도 기본값이 그것이지만,
			 * 계정 쪽(`_app`)이 `noindex`를 걸고 있어서 이 서비스에서 "무엇이
			 * 색인되는가"가 두 곳에 나뉘어 있다. 한쪽만 읽고 반대로 짐작하지
			 * 않도록 양쪽 다 제 입으로 말하게 둔다.
			 */
			{ name: "robots", content: "index, follow" },
			{
				"script:ld+json": {
					"@context": "https://schema.org",
					"@type": "FAQPage",
					mainEntity: FAQ.map((item) => ({
						"@type": "Question",
						name: item.q,
						acceptedAnswer: { "@type": "Answer", text: item.a },
					})),
				},
			},
		],
	}),
	component: Screen,
});

/**
 * 로그인 여부로 갈리는 유일한 자리.
 *
 * - **비로그인** — 원고 한 편을 그대로 연다. 보관함도 사이드바도 없다. 원고지가
 *   어떻게 조판되는지 보러 온 사람이 계정부터 만들 이유가 없다
 * - **로그인** — 위에서 이미 서재로 보냈다. 여기 남는 것은 보관함이 빈
 *   경우뿐이고, 그때는 원고 하나를 만들어 연다
 *
 * 갈림을 라우트에 둔 이유는 쪽(page)끼리 서로를 부를 수 없기 때문이다. 주소를
 * 아는 자리가 여기뿐이라 고르는 일도 여기 있다.
 */
function Screen() {
	const { entry } = Route.useRouteContext();

	if (entry.kind === "empty") return <HomePage />;

	return (
		<>
			{/* 옛 원고가 남아 있으면 알린다. 없으면 아무것도 그리지 않는다 */}
			<LegacyNotice />
			<EditorPage docId={null} />
		</>
	);
}
