import { createFileRoute } from "@tanstack/react-router";
import { GuideIndexPage } from "#/pages/guide";
import { GUIDE_INDEX_PATH } from "#/shared/config/guide";
import { SITE_URL } from "#/shared/config/site";

const TITLE = "원고지 사용법 — 200자 원고지 작성 규칙 정리";
const DESCRIPTION =
	"200자 원고지에 글을 쓸 때 필요한 규칙을 네 갈래로 정리했습니다. 칸 배치와 문단 들여쓰기, 띄어쓰기와 줄바꿈, 문장부호, 공모전 매수 계산.";

export const Route = createFileRoute("/guide/")({
	head: () => ({
		meta: [
			{ title: TITLE },
			{ name: "description", content: DESCRIPTION },
			{ property: "og:title", content: TITLE },
			{ property: "og:description", content: DESCRIPTION },
			{ name: "twitter:title", content: TITLE },
			{ name: "twitter:description", content: DESCRIPTION },
		],
		links: [{ rel: "canonical", href: `${SITE_URL}${GUIDE_INDEX_PATH}` }],
	}),
	component: GuideIndexPage,
});
