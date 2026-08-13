import { describe, expect, it } from "vitest";
import {
	BLANK_ROW_TYPE,
	blockIndexAt,
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

describe("커서가 있는 노드 → 조판 블록", () => {
	/** 빈 문단이 섞인 에디터 문서. 조판 블록은 셋이다 */
	const doc = {
		type: "doc",
		content: [
			{ type: "paragraph", content: [{ type: "text", text: "첫째" }] },
			{ type: "paragraph" },
			{ type: "paragraph", content: [{ type: "text", text: "둘째" }] },
			{ type: "paragraph", content: [{ type: "text", text: "   " }] },
			{ type: "paragraph", content: [{ type: "text", text: "셋째" }] },
		],
	};

	it("빈 문단을 건너뛰고 센다", () => {
		expect(blockIndexAt(doc, 0)).toBe(0);
		// 1번은 빈 문단이다. 그 앞까지 블록이 하나뿐이다
		expect(blockIndexAt(doc, 1)).toBe(1);
		expect(blockIndexAt(doc, 2)).toBe(1);
		// 3번은 공백만 있는 문단이라 역시 버려진다
		expect(blockIndexAt(doc, 4)).toBe(2);
	});

	it("버려지는 노드에 커서가 있으면 다음 블록을 가리킨다", () => {
		// 빈 문단(1번)에 커서가 있으면 이어 쓸 자리인 "둘째"를 본다
		expect(blockIndexAt(doc, 1)).toBe(
			blocksFromDoc(doc).findIndex(
				(b) => b.type === "paragraph" && b.text === "둘째",
			),
		);
	});

	it("노드 번호가 끝을 넘어도 터지지 않는다", () => {
		expect(blockIndexAt(doc, 99)).toBe(3);
	});
});
