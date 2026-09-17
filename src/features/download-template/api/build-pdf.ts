import {
	TEMPLATE_COLORS,
	TEMPLATE_PAPER,
	type TemplateOptions,
	templateLayout,
} from "#/entities/manuscript";

export async function buildTemplatePdf(
	options: TemplateOptions,
	onProgress?: (completed: number) => void,
	signal?: AbortSignal,
): Promise<Blob> {
	const { PDFDocument, StandardFonts, rgb, PrintScaling } = await import(
		"pdf-lib"
	);
	signal?.throwIfAborted();
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	doc.setTitle(`${options.format}자 원고지 양식`);
	doc.setSubject("A4 세로 원고지 양식");
	doc.setCreator("원고지");
	doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
	const hex =
		TEMPLATE_COLORS.find((item) => item.value === options.color)?.hex ??
		"#b95b52";
	const color = rgb(
		Number.parseInt(hex.slice(1, 3), 16) / 255,
		Number.parseInt(hex.slice(3, 5), 16) / 255,
		Number.parseInt(hex.slice(5, 7), 16) / 255,
	);
	const mm = (value: number) => (value * 72) / 25.4;
	for (let index = 0; index < options.pages; index++) {
		signal?.throwIfAborted();
		const { lines, number } = templateLayout(
			options.format,
			options.start + index,
		);
		const page = doc.addPage([
			mm(TEMPLATE_PAPER.width),
			mm(TEMPLATE_PAPER.height),
		]);
		page.drawRectangle({
			x: 0,
			y: 0,
			width: page.getWidth(),
			height: page.getHeight(),
			color: rgb(1, 1, 1),
		});
		for (const line of lines) {
			page.drawLine({
				start: { x: mm(line.x1), y: mm(TEMPLATE_PAPER.height - line.y1) },
				end: { x: mm(line.x2), y: mm(TEMPLATE_PAPER.height - line.y2) },
				thickness: mm(line.width),
				color,
			});
		}
		const label = `No. ${options.start + index}`;
		const size = mm(number.size);
		page.drawText(label, {
			x: mm(number.x) - font.widthOfTextAtSize(label, size),
			y: mm(TEMPLATE_PAPER.height - number.y),
			size,
			font,
			color,
		});
		onProgress?.(index + 1);
		if (onProgress)
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
	}
	const bytes = await doc.save();
	signal?.throwIfAborted();
	return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
