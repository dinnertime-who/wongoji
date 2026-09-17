import { env } from "cloudflare:workers";

/** 비로그인 다운로드는 Cloudflare가 전달한 IP를 기준으로 제한한다. */
export async function limitTemplatePdf(
	request: Request,
	pages: number,
): Promise<Response | null> {
	const key = `wongoji:template-pdf:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`;
	try {
		const regular = await env.TEMPLATE_PDF_RATE_LIMITER.limit({ key });
		const large =
			regular.success && pages > 10
				? await env.TEMPLATE_PDF_LARGE_RATE_LIMITER.limit({ key })
				: null;
		if (!regular.success || large?.success === false) {
			return Response.json(
				{
					error:
						"PDF 다운로드 요청이 너무 많습니다. 1분 후 다시 시도해 주세요.",
				},
				{
					status: 429,
					headers: { "Retry-After": "60", "Cache-Control": "no-store" },
				},
			);
		}
		return null;
	} catch {
		return Response.json(
			{
				error:
					"PDF 다운로드를 잠시 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
			},
			{
				status: 503,
				headers: { "Retry-After": "60", "Cache-Control": "no-store" },
			},
		);
	}
}
