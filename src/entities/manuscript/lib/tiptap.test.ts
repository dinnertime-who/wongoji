import { describe, expect, it } from "vitest";
import {
	BLANK_ROW_TYPE,
	blocksFromDoc,
	blocksToDoc,
	emptyDoc,
	toEditorContent,
} from "./tiptap";
import type { Block } from "./typesetting";

const para = (text: string) => ({ type: "paragraph", text }) as const;
const blank = { type: "blankRow" } as const;

describe("에디터 문서 ↔ 조판 블록", () => {
	it("왕복해도 그대로다", () => {
		const blocks: Block[] = [para("가나다"), blank, para("라마바")];
		expect(blocksFromDoc(blocksToDoc(blocks))).toEqual(blocks);
	});

	it("빈 문단은 버린다 — 원고지에서 문단은 빈 줄로 표시하지 않는다", () => {
		const doc = {
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "가" }] },
				{ type: "paragraph" },
				{ type: "paragraph", content: [{ type: "text", text: "   " }] },
				{ type: "paragraph", content: [{ type: "text", text: "나" }] },
			],
		};
		expect(blocksFromDoc(doc)).toEqual([para("가"), para("나")]);
	});

	it("빈 행은 이름이 하나다 — 에디터가 넣는 것과 읽는 것이 같아야 한다", () => {
		const doc = blocksToDoc([blank]);
		const nodes = (doc as { content: Array<{ type: string }> }).content;
		expect(nodes[0].type).toBe(BLANK_ROW_TYPE);
		expect(blocksFromDoc(doc)).toEqual([blank]);
	});

	it("블록이 없으면 빈 문단 하나를 둔다 — Tiptap이 빈 문서를 거부한다", () => {
		expect(blocksToDoc([])).toEqual(emptyDoc());
	});

	it("한 문단의 여러 텍스트 조각을 이어 붙인다", () => {
		const doc = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "가나" },
						{ type: "text", text: "다라" },
					],
				},
			],
		};
		expect(blocksFromDoc(doc)).toEqual([para("가나다라")]);
	});
});

describe("보관함에서 읽은 본문", () => {
	it("Tiptap 문서는 그대로 쓴다", () => {
		const stored = { type: "doc", content: [{ type: "paragraph" }] };
		expect(toEditorContent(stored)).toBe(stored);
	});

	it("아주 예전에 쓰던 평문은 문단으로 나눈다", () => {
		expect(blocksFromDoc(toEditorContent("가\n나"))).toEqual([
			para("가"),
			para("나"),
		]);
	});

	it("알 수 없는 값이면 빈 원고로 연다", () => {
		expect(toEditorContent(null)).toEqual(emptyDoc());
		expect(toEditorContent(42)).toEqual(emptyDoc());
		expect(toEditorContent({ nope: true })).toEqual(emptyDoc());
	});

	it("빈 원고는 매번 새 객체다 — 부르는 쪽이 고쳐 써도 번지지 않는다", () => {
		expect(emptyDoc()).not.toBe(emptyDoc());
	});
});
