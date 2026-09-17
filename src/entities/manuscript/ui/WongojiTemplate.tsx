import {
	TEMPLATE_COLORS,
	type TemplateColor,
	type TemplateFormat,
} from "../config/templates";
import { TEMPLATE_PAPER, templateLayout } from "../lib/template-layout";

export function WongojiTemplate({
	format,
	color,
	number = 1,
	className,
}: {
	format: TemplateFormat;
	color: TemplateColor;
	number?: number;
	className?: string;
}) {
	const { lines, number: numberPosition } = templateLayout(format, number);
	const stroke = TEMPLATE_COLORS.find((item) => item.value === color)?.hex;
	return (
		<svg
			viewBox={`0 0 ${TEMPLATE_PAPER.width} ${TEMPLATE_PAPER.height}`}
			role="img"
			aria-label={`${format}자 원고지 양식, No. ${number}, A4 세로`}
			className={className}
		>
			<title>
				{format}자 원고지 양식 — No. {number}
			</title>
			<rect
				width={TEMPLATE_PAPER.width}
				height={TEMPLATE_PAPER.height}
				fill="white"
			/>
			<g stroke={stroke} fill="none">
				{lines.map((line) => (
					<path
						key={`${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
						d={`M${line.x1} ${line.y1}L${line.x2} ${line.y2}`}
						strokeWidth={line.width}
					/>
				))}
			</g>
			<text
				x={numberPosition.x}
				y={numberPosition.y}
				textAnchor="end"
				fontFamily="Helvetica, Arial, sans-serif"
				fontSize={numberPosition.size}
				fill={stroke}
			>
				No. {number}
			</text>
		</svg>
	);
}
