import type { Block } from "#/lib/wongoji";

/**
 * 원고 내보내기.
 *
 * 온라인 접수는 한글·워드 파일로 받고, 신춘문예 다수는 A4 출력 우편이다.
 * 원고지 격자를 그대로 제출하는 경우는 사실상 없으므로, 내보내기는 격자가 아니라
 * 공모전 서식(A4 산문)을 만든다. 근거는 docs/contest-features.md.
 */

export interface Manuscript {
	title: string;
	affiliation: string;
	blocks: Block[];
}

/** 파일 이름으로 쓸 수 없는 글자를 걷어낸다 */
function safeFileName(title: string): string {
	const trimmed = title
		.trim()
		.replace(/[\\/:*?"<>|]/g, "")
		.slice(0, 60);
	return trimmed || "원고";
}

function download(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/** 사람이 읽는 평문. 빈 행은 빈 줄로 나가지만 다시 읽어들이면 사라진다 */
export function toPlainText({
	title,
	affiliation,
	blocks,
}: Manuscript): string {
	const head = [title.trim(), affiliation.trim()].filter(Boolean);
	const body = blocks.map((b) => (b.type === "paragraph" ? b.text : ""));
	return [...head, "", ...body].join("\n").trim();
}

export function exportText(manuscript: Manuscript) {
	const blob = new Blob([toPlainText(manuscript)], {
		type: "text/plain;charset=utf-8",
	});
	download(blob, `${safeFileName(manuscript.title)}.txt`);
}

/** 되살릴 수 있는 완전한 사본. 빈 행과 제목·소속까지 그대로 남는다 */
export function exportBackup(manuscript: Manuscript) {
	const payload = { version: 1, ...manuscript };
	const blob = new Blob([JSON.stringify(payload, null, 1)], {
		type: "application/json;charset=utf-8",
	});
	download(blob, `${safeFileName(manuscript.title)}.json`);
}

/**
 * 백업 파일이나 평문을 읽어 원고로 되돌린다.
 *
 * 확장자를 믿지 않고 내용으로 가른다 — 사용자가 파일 이름을 바꿔 두었을 수 있다.
 */
export function parseImported(
	raw: string,
	parseBlocks: (text: string) => Block[],
): Manuscript {
	try {
		const parsed = JSON.parse(raw);
		if (parsed && Array.isArray(parsed.blocks)) {
			return {
				title: typeof parsed.title === "string" ? parsed.title : "",
				affiliation:
					typeof parsed.affiliation === "string" ? parsed.affiliation : "",
				blocks: parsed.blocks as Block[],
			};
		}
	} catch {
		// 평문이라는 뜻이다
	}
	return { title: "", affiliation: "", blocks: parseBlocks(raw) };
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

	if (manuscript.affiliation.trim()) {
		children.push(
			new Paragraph({
				alignment: AlignmentType.RIGHT,
				children: [new TextRun(manuscript.affiliation.trim())],
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
