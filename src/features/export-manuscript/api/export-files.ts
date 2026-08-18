import type { Content } from "@tiptap/react";
import {
	docToFileText,
	type Manuscript,
	safeFileName,
} from "#/entities/manuscript";

/**
 * 원고를 파일로 내보낸다.
 *
 * 온라인 접수는 한글·워드 파일로 받고, 신춘문예 다수는 A4 출력 우편이다.
 * 원고지 격자를 그대로 제출하는 경우는 사실상 없으므로, 내보내기는 격자가 아니라
 * 공모전 서식(A4 산문)을 만든다. 근거는 docs/contest-features.md.
 *
 * 원고를 글자로 옮기는 일은 원고 자신이 안다(entities/manuscript). 여기 있는
 * 것은 그 글자를 파일로 만들어 브라우저에 내려 주는 부수효과뿐이다.
 */

function download(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * 평문 한 편.
 *
 * **조판 블록이 아니라 에디터 문서 원본을 받는다.** 블록은 빈 문단이 버려진
 * 뒤라, 그것으로 적으면 사람이 엔터를 몇 번 쳤는지가 파일에 남지 않는다.
 */
export function exportText(title: string, content: Content) {
	const blob = new Blob([docToFileText(title, content)], {
		type: "text/plain;charset=utf-8",
	});
	download(blob, `${safeFileName(title)}.txt`);
}

/**
 * 공모전 서식 Word 파일.
 *
 * 여러 공모전이 공통으로 요구하는 형태를 기본값으로 삼았다 —
 * 바탕체 11pt, 줄간격 160%, A4, 여백 위 20 / 아래 15 / 좌·우 30 mm.
 * 공모전마다 다르므로 요강을 확인해야 한다.
 *
 * `docx`는 1.0 MB(gzip 214 KB)라 초기 로딩에 얹지 않고 여기서 동적으로 불러온다.
 */
export async function buildDocxBlob(manuscript: Manuscript): Promise<Blob> {
	const { AlignmentType, Document, Packer, Paragraph, TextRun } = await import(
		"docx"
	);

	/** mm → twip (1인치 = 25.4mm = 1440twip) */
	const mm = (value: number) => Math.round((value / 25.4) * 1440);

	const children: InstanceType<typeof Paragraph>[] = [];

	if (manuscript.title.trim()) {
		children.push(
			new Paragraph({
				alignment: AlignmentType.CENTER,
				children: [
					new TextRun({ text: manuscript.title.trim(), bold: true, size: 32 }),
				],
			}),
		);
	}

	if (children.length > 0) children.push(new Paragraph({ children: [] }));

	for (const block of manuscript.blocks) {
		children.push(
			block.type === "paragraph"
				? new Paragraph({
						// 원고지의 첫 칸 들여쓰기에 해당한다
						indent: { firstLine: mm(4) },
						children: [new TextRun(block.text)],
					})
				: new Paragraph({ children: [] }),
		);
	}

	const doc = new Document({
		styles: {
			default: {
				document: {
					// size는 half-point 단위라 22 = 11pt
					run: { font: "바탕", size: 22 },
					// line은 240이 1줄 간격이라 384 = 160%
					paragraph: { spacing: { line: 384 } },
				},
			},
		},
		sections: [
			{
				properties: {
					page: {
						size: { width: mm(210), height: mm(297) },
						margin: {
							top: mm(20),
							bottom: mm(15),
							left: mm(30),
							right: mm(30),
						},
					},
				},
				children,
			},
		],
	});

	return Packer.toBlob(doc);
}

export async function exportDocx(manuscript: Manuscript) {
	download(
		await buildDocxBlob(manuscript),
		`${safeFileName(manuscript.title)}.docx`,
	);
}
