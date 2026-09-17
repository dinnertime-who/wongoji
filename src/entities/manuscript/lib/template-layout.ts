import { TEMPLATE_FORMATS, type TemplateFormat } from "../config/templates";

export const TEMPLATE_PAPER = { width: 210, height: 297 };
export const TEMPLATE_NUMBER = { x: 192, y: 14, size: 3.5 };

export type TemplateLine = {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	width: number;
};

/** 미리보기와 파일 출력은 같은 mm 좌표와 정사각형 칸을 사용한다. */
export function templateLayout(format: TemplateFormat) {
	const spec = TEMPLATE_FORMATS.find((item) => item.value === format);
	if (!spec) throw new Error("지원하지 않는 원고지 양식입니다.");
	const cell = Math.min(174 / spec.columns, 245 / spec.rows);
	const width = cell * spec.columns;
	const height = cell * spec.rows;
	const x = (TEMPLATE_PAPER.width - width) / 2;
	const y = (TEMPLATE_PAPER.height - height) / 2;
	const lines: TemplateLine[] = [];
	for (let col = 0; col <= spec.columns; col++) {
		lines.push({
			x1: x + col * cell,
			y1: y,
			x2: x + col * cell,
			y2: y + height,
			width: 0.15,
		});
	}
	for (let row = 0; row <= spec.rows; row++) {
		lines.push({
			x1: x,
			y1: y + row * cell,
			x2: x + width,
			y2: y + row * cell,
			width: 0.15,
		});
	}
	const left = x - 6,
		top = y - 6,
		right = x + width + 6,
		bottom = y + height + 6;
	lines.push(
		{ x1: left, y1: top, x2: right, y2: top, width: 0.25 },
		{ x1: right, y1: top, x2: right, y2: bottom, width: 0.25 },
		{ x1: right, y1: bottom, x2: left, y2: bottom, width: 0.25 },
		{ x1: left, y1: bottom, x2: left, y2: top, width: 0.25 },
	);
	return { ...spec, cell, lines };
}
