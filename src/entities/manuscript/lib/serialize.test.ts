import { describe, expect, it } from "vitest";
import { parseImported, safeFileName } from "./serialize";

/**
 * 파일에서 온 글을 원고로 되돌린다.
 *
 * **`parseImported`가 이 앱에서 가장 위험한 순수 함수다.** 여기서 읽어 낸 것이
 * 그대로 에디터에 앉고, 앉은 것은 곧 저장되어 원래 원고를 덮는다. 반쯤 읽어
 * 성한 문단만 남기면 사용자는 잃은 줄도 모른다.
 */

describe("예전 백업 파일 읽기", () => {
	it("제목과 블록을 그대로 돌려준다", () => {
		const raw = JSON.stringify({
			version: 1,
			title: "감나무 있는 마당",
			blocks: [
				{ type: "paragraph", text: "첫 문단" },
				{ type: "blankRow" },
				{ type: "paragraph", text: "둘째 문단" },
			],
		});
		expect(parseImported(raw)).toEqual({
			title: "감나무 있는 마당",
			blocks: [
				{ type: "paragraph", text: "첫 문단" },
				{ type: "blankRow" },
				{ type: "paragraph", text: "둘째 문단" },
			],
		});
	});

	it("블록이 하나라도 성치 않으면 통째로 평문으로 읽는다", () => {
		/*
		 * **반쯤 살리지 않는다.** 성한 것만 남기면 조용히 일부를 잃고, 그 상태로
		 * 저장되면 원본이 사라진다. 통째로 글자로 읽으면 적어도 눈에 보인다.
		 */
		const raw = JSON.stringify({
			title: "제목",
			blocks: [{ type: "paragraph", text: "성한 것" }, { type: "표" }],
		});
		const 읽음 = parseImported(raw);
		expect(읽음.title).toBe("");
		// JSON 글자 그대로가 문단이 된다 — 잃은 것이 없다
		expect(읽음.blocks.length).toBeGreaterThan(0);
		expect(
			읽음.blocks.map((b) => ("text" in b ? b.text : "")).join(""),
		).toContain("성한 것");
	});

	it("문단인데 글이 문자열이 아니면 성치 않은 것이다", () => {
		const raw = JSON.stringify({
			blocks: [{ type: "paragraph", text: 42 }],
		});
		expect(parseImported(raw).title).toBe("");
	});

	it("제목이 문자열이 아니면 빈 제목으로 둔다", () => {
		const raw = JSON.stringify({
			title: 42,
			blocks: [{ type: "paragraph", text: "본문" }],
		});
		expect(parseImported(raw)).toEqual({
			title: "",
			blocks: [{ type: "paragraph", text: "본문" }],
		});
	});

	it("블록이 비어 있는 백업도 백업이다", () => {
		const raw = JSON.stringify({ title: "빈 원고", blocks: [] });
		expect(parseImported(raw)).toEqual({ title: "빈 원고", blocks: [] });
	});
});

describe("평문 읽기", () => {
	it("JSON이 아니면 평문이다", () => {
		expect(parseImported("첫 줄\n둘째 줄")).toEqual({
			title: "",
			blocks: [
				{ type: "paragraph", text: "첫 줄" },
				{ type: "paragraph", text: "둘째 줄" },
			],
		});
	});

	it("blocks가 배열이 아닌 JSON도 평문이다", () => {
		const 읽음 = parseImported(JSON.stringify({ title: "제목", blocks: "글" }));
		expect(읽음.title).toBe("");
	});

	it("확장자를 믿지 않는다 — 내용으로 가른다", () => {
		// 예전 백업을 .txt로 바꿔 두었어도 백업으로 읽힌다
		const 백업 = {
			version: 1,
			title: "제목",
			blocks: [{ type: "paragraph", text: "본문" }],
		};
		expect(parseImported(JSON.stringify(백업)).title).toBe("제목");
	});

	it("빈 글은 빈 원고다", () => {
		expect(parseImported("")).toEqual({ title: "", blocks: [] });
	});
});

describe("파일 이름", () => {
	it("파일 이름으로 쓸 수 없는 글자를 걷어낸다", () => {
		expect(safeFileName('나/의:원*고?"<>|')).toBe("나의원고");
	});

	it("예순 자에서 자른다", () => {
		expect(safeFileName("가".repeat(100))).toHaveLength(60);
	});

	it("남는 것이 없으면 '원고'다", () => {
		expect(safeFileName("///")).toBe("원고");
		expect(safeFileName("   ")).toBe("원고");
		expect(safeFileName("")).toBe("원고");
	});
});
