import { describe, expect, it } from "vitest";
import {
	buildDocxBlob,
	type Manuscript,
	parseImported,
	toPlainText,
} from "#/lib/export";
import { type Block, parseBlocks } from "#/lib/wongoji";

const SAMPLE: Manuscript = {
	title: "감나무 있는 마당",
	blocks: [
		{ type: "paragraph", text: "가을이 깊었다." },
		{ type: "blankRow" },
		{ type: "paragraph", text: '"올해도 감은 안 열리려나?"' },
	],
};

/**
 * docx는 zip이다. 안의 XML을 꺼내 서식이 실제로 들어갔는지 본다.
 *
 * zip 항목은 zlib 헤더 없는 raw deflate라 `inflateRawSync`로 펴야 한다.
 */
async function docxXml(manuscript: Manuscript): Promise<string> {
	const buf = new Uint8Array(
		await (await buildDocxBlob(manuscript)).arrayBuffer(),
	);
	const { inflateRawSync } = await import("node:zlib");
	const read32 = (at: number) =>
		buf[at] | (buf[at + 1] << 8) | (buf[at + 2] << 16) | (buf[at + 3] << 24);

	const parts: string[] = [];
	for (let i = 0; i + 30 < buf.length; i++) {
		// 로컬 파일 헤더 서명 PK\x03\x04
		if (read32(i) !== 0x04034b50) continue;
		const compSize = read32(i + 18);
		const nameLen = buf[i + 26] | (buf[i + 27] << 8);
		const extraLen = buf[i + 28] | (buf[i + 29] << 8);
		const start = i + 30 + nameLen + extraLen;
		if (compSize <= 0 || start + compSize > buf.length) continue;
		try {
			parts.push(
				inflateRawSync(buf.subarray(start, start + compSize)).toString("utf-8"),
			);
		} catch {
			// 저장(무압축) 항목 등은 건너뛴다
		}
	}
	return parts.join("\n");
}

describe("평문 · 백업", () => {
	it("평문에는 제목과 소속이 앞에 붙는다", () => {
		const text = toPlainText(SAMPLE);
		expect(text.startsWith("감나무 있는 마당")).toBe(true);
		expect(text).toContain("가을이 깊었다.");
	});

	it("백업 JSON을 다시 읽으면 제목과 빈 행이 살아난다", () => {
		const restored = parseImported(
			JSON.stringify({ version: 1, ...SAMPLE }),
			parseBlocks,
		);
		expect(restored).toEqual(SAMPLE);
		expect(restored.blocks.some((b: Block) => b.type === "blankRow")).toBe(
			true,
		);
	});

	it("평문 파일은 문단으로 읽어들인다", () => {
		const restored = parseImported("가나\n다라", parseBlocks);
		expect(restored.title).toBe("");
		expect(restored.blocks).toHaveLength(2);
	});

	it("망가진 JSON은 평문으로 본다", () => {
		expect(
			parseImported("{ 이건 JSON이 아니다", parseBlocks).blocks,
		).toHaveLength(1);
	});
});

describe("Word 내보내기", () => {
	it("공모전 서식이 파일에 들어간다", async () => {
		const xml = await docxXml(SAMPLE);

		expect(xml).toContain("바탕"); // 글꼴
		expect(xml).toContain('w:sz w:val="22"'); // 본문 11pt
		expect(xml).toContain('w:line="384"'); // 줄간격 160%
		expect(xml).toContain('w:w="11906"'); // A4 폭
		expect(xml).toContain('w:top="1134"'); // 위 여백 20mm
		expect(xml).toContain('w:left="1701"'); // 좌 여백 30mm
	});

	it("제목과 본문이 그대로 담긴다", async () => {
		const xml = await docxXml(SAMPLE);
		expect(xml).toContain("감나무 있는 마당");
		expect(xml).toContain("가을이 깊었다.");
	});

	it("제목이 없으면 제목 문단을 넣지 않는다", async () => {
		const blob = await buildDocxBlob({ ...SAMPLE, title: "" });
		expect(blob.size).toBeGreaterThan(0);
	});
});
