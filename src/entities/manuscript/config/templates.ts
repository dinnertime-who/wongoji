export const TEMPLATE_FORMATS = [
	{
		value: 200,
		columns: 20,
		rows: 10,
		description:
			"20칸 × 10줄의 200자 원고지입니다. 짧은 글과 손글씨 연습에 사용할 수 있습니다.",
	},
	{
		value: 400,
		columns: 20,
		rows: 20,
		description:
			"20칸 × 20줄의 400자 원고지입니다. 200자 양식과 같은 칸 너비로 두 배의 분량을 담습니다.",
	},
	{
		value: 1000,
		columns: 25,
		rows: 40,
		description:
			"25칸 × 40줄의 1000자 원고지입니다. 한 장에 긴 글을 담을 수 있도록 칸이 작게 배치됩니다.",
	},
] as const;

export const TEMPLATE_COLORS = [
	{ value: "red", label: "붉은색", hex: "#b95b52" },
	{ value: "green", label: "초록색", hex: "#8aa87b" },
] as const;

export type TemplateFormat = (typeof TEMPLATE_FORMATS)[number]["value"];
export type TemplateColor = (typeof TEMPLATE_COLORS)[number]["value"];
export type TemplateOptions = {
	format: TemplateFormat;
	color: TemplateColor;
	pages: number;
	start: number;
};

export const MAX_TEMPLATE_PAGES = 100;
export const DEFAULT_TEMPLATE_OPTIONS: TemplateOptions = {
	format: 200,
	color: "red",
	pages: 1,
	start: 1,
};

export function readTemplateOptions(
	params: URLSearchParams,
): TemplateOptions | null {
	const format = TEMPLATE_FORMATS.find(
		(item) => String(item.value) === (params.get("format") ?? "200"),
	)?.value;
	const color = TEMPLATE_COLORS.find(
		(item) => item.value === (params.get("color") ?? "red"),
	)?.value;
	const pages = Number(params.get("pages") ?? "1");
	const start = Number(params.get("start") ?? "1");
	if (
		!format ||
		!color ||
		!Number.isSafeInteger(pages) ||
		pages < 1 ||
		pages > MAX_TEMPLATE_PAGES ||
		!Number.isSafeInteger(start) ||
		start < 1 ||
		!Number.isSafeInteger(start + pages - 1)
	)
		return null;
	return { format, color, pages, start };
}

export function templatePdfUrl(options: TemplateOptions): string {
	return `/api/templates/pdf?${new URLSearchParams({
		format: String(options.format),
		color: options.color,
		pages: String(options.pages),
		start: String(options.start),
	})}`;
}

export function templateFileName(options: TemplateOptions): string {
	return `wongoji-${options.format}-${options.color}-No.${options.start}-${options.start + options.pages - 1}`;
}
