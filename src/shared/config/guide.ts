import { SITE_URL } from "./site";

/**
 * 원고지 사용법 글 목록.
 *
 * **한 곳에 모아 두는 이유는 읽는 데가 넷이기 때문이다.** 라우트가 문서 머리를
 * 짓고, 목차가 늘어놓고, 에디터 발치의 링크가 가리키고, 테스트가 sitemap과
 * 맞대어 본다. 글을 하나 더할 때 고칠 곳은 이 배열 하나다.
 *
 * 검색 의도가 다른 것을 한 쪽에 몰지 않았다. "원고지 띄어쓰기"로 온 사람과
 * "신춘문예 매수"로 온 사람은 같은 것을 찾는 것이 아니라, 한 쪽이 둘 다에
 * 걸리려 하면 어느 쪽에도 잘 걸리지 않는다.
 */
export interface Article {
	/** 주소의 끝. `/guide/<slug>` */
	slug: string;
	/** 검색 결과에 걸리는 제목 */
	title: string;
	/** 목차와 글 머리에 쓰는 짧은 이름 */
	label: string;
	/** 검색 결과의 설명 */
	description: string;
	/** 목차에서 한 줄 소개 */
	summary: string;
}

export const ARTICLES: Article[] = [
	{
		slug: "rules",
		title: "원고지 쓰는 법 — 200자 원고지 기본 규칙",
		label: "원고지 쓰는 법",
		description:
			"200자 원고지의 칸 배치, 첫 장에 제목과 이름을 놓는 자리, 문단 들여쓰기, 한 칸에 몇 자를 쓰는지까지. 국립국어원이 표준이 없다고 답한 자리에서 무엇을 기준으로 삼을지부터 짚습니다.",
		summary:
			"20칸 × 10줄이 왜 200자인지부터. 첫 장 배치, 문단 들여쓰기, 한글·숫자·알파벳이 한 칸에 몇 자씩 들어가는지.",
	},
	{
		slug: "line-breaks",
		title: "원고지 띄어쓰기와 줄바꿈 규칙",
		label: "띄어쓰기와 줄바꿈",
		description:
			"원고지에서 띄어쓰기는 한 칸을 차지하지만 줄의 첫 칸에는 오지 않습니다. 줄 끝에서 띄어야 할 칸이 없을 때, 문단이 바뀔 때, 대화문일 때 첫 칸을 어떻게 두는지 정리했습니다.",
		summary:
			"띄어쓰기가 줄 첫 칸에 오지 못하는 이유와, 줄 끝에서 칸이 모자랄 때의 처리. 대화문만 규칙이 다릅니다.",
	},
	{
		slug: "punctuation",
		title: "원고지 문장부호 쓰는 법",
		label: "문장부호",
		description:
			"마침표·쉼표 뒤는 비우지 않고 물음표·느낌표 뒤는 한 칸 비웁니다. 줄표와 말줄임표는 두 칸입니다. 줄 마지막 칸에 부호를 찍을 자리가 없을 때의 처리는 자료마다 넷으로 갈립니다.",
		summary:
			"부호마다 몇 칸을 쓰고 뒤를 비우는지. 줄 끝에 자리가 없을 때 앞 칸에 합쳐 넣는 규칙까지.",
	},
	{
		slug: "contest",
		title: "공모전 원고지 매수 계산 — 신춘문예 70매는 몇 자인가",
		label: "공모전 매수 계산",
		description:
			"원고지 매수를 세는 방법은 글자수 기준과 조판 기준 둘로 갈리고, 한글(HWP)은 조판 기준을 씁니다. 대화가 많은 소설에서는 둘이 18%까지 벌어져, 요강에 맞춰 썼다고 믿은 원고가 분량을 넘깁니다.",
		summary:
			"같은 원고에서 다른 숫자가 나오는 이유. 신춘문예 70매·백일장 10매가 실제로 몇 자인지.",
	},
];

/** 목차 자신. sitemap에는 이것도 들어간다 */
export const GUIDE_INDEX_PATH = "/guide";

export function articlePath(slug: string): string {
	return `${GUIDE_INDEX_PATH}/${slug}`;
}

export function articleUrl(slug: string): string {
	return `${SITE_URL}${articlePath(slug)}`;
}

/**
 * 이 글이 사이트 어디쯤에 있는가. 구조화 데이터로 나간다.
 *
 * 검색 결과에서 주소 대신 `원고지 › 사용법 › 문장부호`로 보이는 그것이다. 쪽이
 * 어느 갈래에 속하는지도 함께 알려 주므로, 사용법 글 넷이 홈에 딸린 한 묶음으로
 * 읽힌다 — 따로 떨어진 쪽 넷일 때보다 낫다.
 *
 * 목차 자신이면 `article`이 없다. 그때는 두 단이다.
 */
export function breadcrumb(article?: Article) {
	const trail = [
		{ name: "원고지", url: SITE_URL },
		{ name: "사용법", url: `${SITE_URL}${GUIDE_INDEX_PATH}` },
		...(article
			? [{ name: article.label, url: articleUrl(article.slug) }]
			: []),
	];

	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: trail.map((step, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: step.name,
			item: step.url,
		})),
	};
}

/** sitemap에 들어가야 할 주소 전부. 목차가 앞, 글이 뒤 */
export function guideUrls(): string[] {
	return [
		`${SITE_URL}${GUIDE_INDEX_PATH}`,
		...ARTICLES.map((a) => articleUrl(a.slug)),
	];
}

/**
 * 글이 근거로 대는 바깥 자료.
 *
 * **한 곳에 모아 둔다.** 링크는 썩고, 썩었을 때 넷으로 흩어져 있으면 어디를
 * 고쳐야 하는지 찾는 데 시간이 든다. TOPIK 원문과 국립국어원 답변은 여기 없다 —
 * 그 둘은 앱이 규칙 창에서도 쓰므로 `entities/manuscript`에 산다.
 */
export const SOURCES = {
	wikipedia: "https://ko.wikipedia.org/wiki/원고지",
	gulnara:
		"https://www.gulnara.net/index.php?zsect=reading&zapp=board&zact=viewboard&pknv=37&uid=1112",
	gulnaraKids:
		"https://www.gulnara.net/index.php?zsect=reading&zapp=board&zact=viewboard&pknv=35&uid=1110",
	hancom:
		"https://help.hancom.com/hoffice/multi/ko_kr/hwp/file/document_properties/document_statistics.htm",
	contestKorea:
		"https://www.contestkorea.com/sub/view.php?int_gbn=1&Txt_bcode=030110001&str_no=202510220037",
} as const;
