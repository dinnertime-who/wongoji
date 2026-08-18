import { describe, expect, it } from "vitest";
import { docToFileText, docToPlainText } from "./plain-text";
import { blocksToDoc } from "./tiptap";

/**
 * 이 함수가 지키는 것은 하나다 — **사람이 친 엔터를 세지 않고 그대로 옮긴다.**
 *
 * 조판을 거친 글(`blocksFromDoc`)에는 이 정보가 없으므로, 여기서 잃으면 어디서도
 * 되찾을 수 없다.
 */

/** 편집기가 내놓는 모양 그대로 짓는다. 빈 문단은 content가 없다 */
const doc = (...nodes: Array<string | null | "빈행">) => ({
	type: "doc",
	content: nodes.map((n) =>
		n === "빈행"
			? { type: "horizontalRule" }
			: n
				? { type: "paragraph", content: [{ type: "text", text: n }] }
				: { type: "paragraph" },
	),
});

describe("빈 줄을 세지 않는다", () => {
	it("엔터 두 번은 빈 줄 하나로 나간다", () => {
		expect(docToPlainText(doc("가", null, "나"))).toBe("가\n\n나");
	});

	it("엔터를 다섯 번 치면 빈 줄이 넷이다", () => {
		const 원고 = doc("가", null, null, null, null, "나");
		expect(docToPlainText(원고)).toBe("가\n\n\n\n\n나");
		// 눈으로도 세어 둔다 — 줄 수가 곧 이 함수의 계약이다
		expect(docToPlainText(원고).split("\n")).toHaveLength(6);
	});

	it("빈 줄을 하나로 합치지 않는다", () => {
		const 셋 = docToPlainText(doc("가", null, null, null, "나"));
		expect(셋).not.toBe("가\n\n나");
	});

	it("빈 행도 빈 줄 하나다", () => {
		expect(docToPlainText(doc("가", "빈행", "나"))).toBe("가\n\n나");
	});

	it("빈 행과 빈 문단이 섞여도 순서와 개수가 그대로다", () => {
		expect(docToPlainText(doc("가", "빈행", null, "빈행", "나"))).toBe(
			"가\n\n\n\n나",
		);
	});
});

describe("가장자리", () => {
	it("끝에 붙은 빈 줄은 걷는다", () => {
		expect(docToPlainText(doc("가", null, null))).toBe("가");
	});

	it("앞의 빈 줄은 남긴다 — 글쓴이가 띄운 자리다", () => {
		expect(docToPlainText(doc(null, "가"))).toBe("\n가");
	});

	it("가운데 빈 줄은 끝을 걷어도 남는다", () => {
		expect(docToPlainText(doc("가", null, "나", null, null))).toBe("가\n\n나");
	});

	it("빈 원고는 빈 글이다", () => {
		expect(docToPlainText(doc(null))).toBe("");
	});

	it("문서가 아닌 것을 받아도 터지지 않는다", () => {
		expect(docToPlainText(null)).toBe("");
		expect(docToPlainText("글자" as never)).toBe("");
	});
});

describe("조판을 거치면 잃는다 — 그래서 원본을 읽는다", () => {
	it("blocks로 지은 문서에는 빈 문단이 없다", () => {
		/*
		 * `blocksToDoc`은 조판 블록에서 짓는 것이고, 그 블록은 이미 빈 문단이
		 * 버려진 뒤다. 여기서 빈 줄이 나오지 않는다는 것이 이 함수가 원본 JSON을
		 * 받아야 하는 이유 자체다.
		 */
		const 조판을거친것 = blocksToDoc([
			{ type: "paragraph", text: "가" },
			{ type: "paragraph", text: "나" },
		]);
		expect(docToPlainText(조판을거친것)).toBe("가\n나");
	});
});

describe("파일에 적는 글", () => {
	it("제목을 맨 위에 두고 한 줄 띄운다", () => {
		expect(docToFileText("제목", doc("가"))).toBe("제목\n\n가");
	});

	it("제목이 없으면 넣지 않는다", () => {
		expect(docToFileText("   ", doc("가"))).toBe("가");
	});

	it("본문이 비면 제목만 남는다", () => {
		expect(docToFileText("제목", doc(null))).toBe("제목");
	});

	it("제목 뒤의 여백은 본문 것이라 그대로 둔다", () => {
		expect(docToFileText("제목", doc(null, null, "가"))).toBe("제목\n\n\n\n가");
	});
});
