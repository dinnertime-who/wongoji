import { createFileRoute } from "@tanstack/react-router";
import { TEMPLATE_FORMATS } from "#/entities/manuscript";
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
					"@type": "CollectionPage",
					"@id": `${TEMPLATE_PAGE_URL}#webpage`,
					url: TEMPLATE_PAGE_URL,
					name: TEMPLATE_PAGE_TITLE,
					description: TEMPLATE_PAGE_DESCRIPTION,
					inLanguage: "ko-KR",
					isAccessibleForFree: true,
					breadcrumb: { "@id": `${TEMPLATE_PAGE_URL}#breadcrumb` },
					mainEntity: {
						"@type": "ItemList",
						numberOfItems: TEMPLATE_FORMATS.length,
						itemListElement: TEMPLATE_FORMATS.map((format, index) => ({
							"@type": "ListItem",
							position: index + 1,
							item: {
								"@type": "DigitalDocument",
								"@id": `${TEMPLATE_PAGE_URL}#template-${format.value}`,
								url: `${TEMPLATE_PAGE_URL}#template-${format.value}`,
								name: `${format.value}자 원고지 양식`,
								description: format.description,
								encodingFormat: ["application/pdf", "image/png"],
								isAccessibleForFree: true,
							},
						})),
					},
				},
			},
			{
				"script:ld+json": {
					"@context": "https://schema.org",
					"@type": "BreadcrumbList",
					"@id": `${TEMPLATE_PAGE_URL}#breadcrumb`,
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
