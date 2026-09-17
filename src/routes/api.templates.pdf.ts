import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { readTemplateOptions, templateFileName } from "#/entities/manuscript";
import { buildTemplatePdf } from "#/features/download-template";

export const Route = createFileRoute("/api/templates/pdf")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const { limitTemplatePdf } = await import("#/server/template-limit");
				const params = new URL(request.url).searchParams;
				const limited = await limitTemplatePdf(
					request,
					Number(params.get("pages") ?? "1"),
				);
				if (limited) return limited;
				const options = readTemplateOptions(params);
				if (!options)
					return Response.json(
						{
							error:
								"양식, 색상, 페이지 수 또는 시작 번호가 올바르지 않습니다.",
						},
						{ status: 400 },
					);
				try {
					return new Response(
						await buildTemplatePdf(options, undefined, request.signal),
						{
							headers: {
								"Content-Type": "application/pdf",
								"Content-Disposition": `attachment; filename="${templateFileName(options)}.pdf"`,
								"Cache-Control": "public, max-age=86400",
								"X-Robots-Tag": "noindex",
								"X-Content-Type-Options": "nosniff",
							},
						},
					);
				} catch {
					return Response.json(
						{ error: "PDF를 만들지 못했습니다. 다시 시도해 주세요." },
						{ status: 500 },
					);
				}
			},
		},
	},
});
