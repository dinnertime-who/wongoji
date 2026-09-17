import { TEMPLATE_FORMATS, type TemplateFormat } from "../config/templates";

export const TEMPLATE_PAPER = { width: 210, height: 297 };
export const WONGOJI_ROW_GAP_RATIO = 0.3;
const PX_TO_MM = 25.4 / 96;
export const TEMPLATE_NUMBER = {
	gap: 12 * PX_TO_MM,
	textGap: 4 * PX_TO_MM,
	padding: 4 * PX_TO_MM,
	borderWidth: PX_TO_MM,
	size: 3.5,
};

export type TemplateLine = {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	width: number;
};

/** 미리보기와 파일 출력은 같은 mm 좌표와 정사각형 칸을 사용한다. */
export function templateLayout(format: TemplateFormat, pageNumber = 1) {
	const spec = TEMPLATE_FORMATS.find((item) => item.value === format);
	if (!spec) throw new Error("지원하지 않는 원고지 양식입니다.");
	const totalRowHeight = spec.rows + (spec.rows - 1) * WONGOJI_ROW_GAP_RATIO;
	const cell = Math.min(174 / spec.columns, 245 / totalRowHeight);
	const rowGap = cell * WONGOJI_ROW_GAP_RATIO;
	const width = cell * spec.columns;
	const height = cell * totalRowHeight;
	const x = (TEMPLATE_PAPER.width - width) / 2;
	const y = (TEMPLATE_PAPER.height - height) / 2;
	const lines: TemplateLine[] = [
		{ x1: x, y1: y, x2: x, y2: y + height, width: 0.15 },
		{ x1: x + width, y1: y, x2: x + width, y2: y + height, width: 0.15 },
	];
	for (let row = 0; row < spec.rows; row++) {
		const rowTop = y + row * (cell + rowGap);
		const rowBottom = rowTop + cell;
		for (let col = 1; col < spec.columns; col++) {
			lines.push({
				x1: x + col * cell,
				y1: rowTop,
				x2: x + col * cell,
				y2: rowBottom,
				width: 0.15,
			});
		}
		lines.push(
			{ x1: x, y1: rowTop, x2: x + width, y2: rowTop, width: 0.15 },
			{ x1: x, y1: rowBottom, x2: x + width, y2: rowBottom, width: 0.15 },
		);
	}
	const left = x - 6,
		top = y - 6,
		right = x + width + 6,
		bottom = y + height + 6;
	const numberBorderY = top - TEMPLATE_NUMBER.gap;
	// Helvetica의 접두사와 숫자 폭으로 번호 길이에 맞춰 밑줄을 그린다.
	const numberTextWidth =
		TEMPLATE_NUMBER.size * (1.734 + String(pageNumber).length * 0.556);
	lines.push(
		{ x1: left, y1: top, x2: right, y2: top, width: 0.25 },
		{ x1: right, y1: top, x2: right, y2: bottom, width: 0.25 },
		{ x1: right, y1: bottom, x2: left, y2: bottom, width: 0.25 },
		{ x1: left, y1: bottom, x2: left, y2: top, width: 0.25 },
		{
			x1: right - numberTextWidth - TEMPLATE_NUMBER.padding * 2,
			y1: numberBorderY,
			x2: right,
			y2: numberBorderY,
			width: TEMPLATE_NUMBER.borderWidth,
		},
	);
	return {
		...spec,
		cell,
		rowGap,
		lines,
		number: {
			x: right - TEMPLATE_NUMBER.padding,
			y: numberBorderY - TEMPLATE_NUMBER.textGap,
			size: TEMPLATE_NUMBER.size,
		},
	};
}
