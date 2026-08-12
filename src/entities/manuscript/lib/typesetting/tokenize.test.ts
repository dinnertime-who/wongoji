import { describe, expect, it } from "vitest";
import { TOPIK_PROFILE } from "./profile";
import { tokenizeParagraph } from "./tokenize";

/**
 * 토큰이 차지하는 칸을 사람이 읽을 수 있는 문자열로. 빈 칸은 `·`, 한 칸에
 * 여러 글리프면 그대로 이어 붙인다.
 *
 * 배치를 거치지 않으므로 들여쓴 첫 칸이 없다 — 그것은 layout의 몫이다.
 */
function cells(text: string): string {
	return tokenizeParagraph(text, TOPIK_PROFILE)
		.flatMap((t) => t.cells)
		.map((c) => (c.glyphs.length ? c.glyphs.join("") : "·"))
		.join("|");
}

describe("토큰화 — 한 칸에 무엇이 들어가는가", () => {
	it("E1: 연속 숫자는 앞에서부터 두 자씩 끊는다", () => {
		expect(cells("123")).toBe("12|3");
	});

	it("E2: TOPIK 프로파일은 한 자리 숫자도 예외를 두지 않는다", () => {
		expect(cells("4천")).toBe("4|천");
		expect(cells("2024년")).toBe("20|24|년");
	});

	it("E3: 대문자는 1칸 1자, 소문자는 1칸 2자", () => {
		expect(cells("Korea")).toBe("K|or|ea");
		expect(cells("ABC")).toBe("A|B|C");
		expect(cells("hello")).toBe("he|ll|o");
	});

	it("E4: 숫자와 알파벳이 섞이면 한 자씩 따로 적는다", () => {
		expect(cells("A4")).toBe("A|4");
		expect(cells("mp3")).toBe("m|p|3");
	});

	it("E5: 줄임표와 줄표는 두 칸을 차지한다", () => {
		expect(cells("아……")).toBe("아|…|…");
		expect(cells("아…")).toBe("아|…|…");
		expect(cells("아...")).toBe("아|…|…");
		expect(cells("아—")).toBe("아|―|―");
	});

	it("E7: 한글·한자는 1칸 1자", () => {
		expect(cells("한글漢字")).toBe("한|글|漢|字");
	});
});

describe("문장부호 뒤 띄어쓰기 — TOPIK 6항", () => {
	it("물음표·느낌표 뒤에는 한 칸을 비운다", () => {
		expect(cells("네? 그래")).toBe("네|?|·|그|래");
		// 입력에 공백이 없어도 규칙대로 비운다
		expect(cells("네?그래")).toBe("네|?|·|그|래");
	});

	it("온점·반점 뒤는 비우지 않는다", () => {
		expect(cells("가다. 나다")).toBe("가|다|.|나|다");
		expect(cells("가, 나")).toBe("가|,|나");
	});

	it("E13: 물음표 바로 뒤에 닫는 따옴표가 오면 비우지 않는다", () => {
		expect(cells('"뭐?" 하고')).toBe('"|뭐|?|"|·|하|고');
	});

	it("문단 끝의 물음표 뒤에는 비울 것이 없다", () => {
		expect(cells("왜?")).toBe("왜|?");
	});
});

describe("따옴표", () => {
	it("따옴표는 각각 한 칸을 차지한다", () => {
		expect(cells('"가"')).toBe('"|가|"');
	});

	it("아포스트로피는 따옴표로 세지 않는다", () => {
		expect(cells("don't")).toBe("do|n|'|t");
	});
});
