import { createFileRoute } from "@tanstack/react-router";
import { TemplatesPage } from "#/pages/templates";
import { SITE_URL } from "#/shared/config/site";
import {
	TEMPLATE_PAGE_DESCRIPTION,
	TEMPLATE_PAGE_KEYWORDS,
	TEMPLATE_PAGE_TITLE,
	TEMPLATE_PAGE_URL,
} from "#/shared/config/template-page";

export const Route = createFileRoute("/templates")({
	head: () => ({
		meta: [
			{ title: TEMPLATE_PAGE_TITLE },
			{ name: "description", content: TEMPLATE_PAGE_DESCRIPTION },
			{ name: "keywords", content: TEMPLATE_PAGE_KEYWORDS },
			{ name: "robots", content: "index, follow" },
			{ property: "og:url", content: TEMPLATE_PAGE_URL },
			{ property: "og:site_name", content: "원고지" },
			{ property: "og:title", content: TEMPLATE_PAGE_TITLE },
			{ property: "og:description", content: TEMPLATE_PAGE_DESCRIPTION },
			{ name: "twitter:title", content: TEMPLATE_PAGE_TITLE },
			{ name: "twitter:description", content: TEMPLATE_PAGE_DESCRIPTION },
			{
				"script:ld+json": {
					"@context": "https://schema.org",
					"@type": "BreadcrumbList",
					itemListElement: [
						{
							"@type": "ListItem",
							position: 1,
							name: "원고지",
							item: SITE_URL,
						},
						{
							"@type": "ListItem",
							position: 2,
							name: "원고지 양식 다운로드",
							item: TEMPLATE_PAGE_URL,
						},
					],
				},
			},
		],
		links: [{ rel: "canonical", href: TEMPLATE_PAGE_URL }],
	}),
	component: TemplatesPage,
});
