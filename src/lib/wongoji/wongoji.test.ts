import { describe, expect, it } from "vitest";
import { layout, layoutBlocks, parseBlocks } from "./layout";
import { TOPIK_PROFILE } from "./profile";
import { tokenizeParagraph } from "./tokenize";
import { type Cell, COLS } from "./types";

/** 한 줄을 사람이 읽을 수 있는 문자열로. 빈 칸은 `·`, 한 칸에 여러 글리프면 그대로 이어 붙인다. */
function renderLine(cells: Cell[]): string {
	return cells
		.map((c) => (c.glyphs.length ? c.glyphs.join("") : "·"))
		.join("|");
}

function lines(text: string): string[] {
	const { pages } = layout(text);
	return pages
		.flatMap((p) => p.lines)
		.filter((l) => l.cells.length > 0)
		.map((l) => renderLine(l.cells));
}

/** 토큰이 차지하는 칸 수 */
function cellCount(text: string): number {
	return tokenizeParagraph(text, TOPIK_PROFILE).reduce(
		(n, t) => n + (t.role === "space" ? 1 : t.cells.length),
		0,
	);
}

describe("토큰화 — 한 칸에 무엇이 들어가는가", () => {
	it("E1: 연속 숫자는 앞에서부터 두 자씩 끊는다", () => {
		expect(lines("123")[0]).toBe("·|12|3");
	});

	it("E2: TOPIK 프로파일은 한 자리 숫자도 예외를 두지 않는다", () => {
		expect(lines("4천")[0]).toBe("·|4|천");
		expect(lines("2024년")[0]).toBe("·|20|24|년");
	});

	it("E3: 대문자는 1칸 1자, 소문자는 1칸 2자", () => {
		expect(lines("Korea")[0]).toBe("·|K|or|ea");
		expect(lines("ABC")[0]).toBe("·|A|B|C");
		expect(lines("hello")[0]).toBe("·|he|ll|o");
	});

	it("E4: 숫자와 알파벳이 섞이면 한 자씩 따로 적는다", () => {
		expect(lines("A4")[0]).toBe("·|A|4");
		expect(lines("mp3")[0]).toBe("·|m|p|3");
	});

	it("E5: 줄임표와 줄표는 두 칸을 차지한다", () => {
		expect(lines("아……")[0]).toBe("·|아|…|…");
		expect(lines("아…")[0]).toBe("·|아|…|…");
		expect(lines("아...")[0]).toBe("·|아|…|…");
		expect(lines("아—")[0]).toBe("·|아|―|―");
	});

	it("E7: 한글·한자는 1칸 1자", () => {
		expect(lines("한글漢字")[0]).toBe("·|한|글|漢|字");
	});
});

describe("문장부호 뒤 띄어쓰기 — TOPIK 6항", () => {
	it("물음표·느낌표 뒤에는 한 칸을 비운다", () => {
		expect(lines("네? 그래")[0]).toBe("·|네|?|·|그|래");
		// 입력에 공백이 없어도 규칙대로 비운다
		expect(lines("네?그래")[0]).toBe("·|네|?|·|그|래");
	});

	it("온점·반점 뒤는 비우지 않는다", () => {
		expect(lines("가다. 나다")[0]).toBe("·|가|다|.|나|다");
		expect(lines("가, 나")[0]).toBe("·|가|,|나");
	});

	it("E13: 물음표 바로 뒤에 닫는 따옴표가 오면 비우지 않는다", () => {
		expect(lines('"뭐?" 하고')[0]).toBe('·|"|뭐|?|"|·|하|고');
	});

	it("문단 끝의 물음표 뒤에는 비울 것이 없다", () => {
		expect(lines("왜?")[0]).toBe("·|왜|?");
	});
});

describe("줄 배치 — 20칸 경계", () => {
	it("E16: 문단 첫 줄만 들여쓰고 둘째 줄부터는 첫 칸을 채운다", () => {
		const out = lines("가".repeat(30));
		expect(out[0]).toBe(["·", ...Array(19).fill("가")].join("|"));
		expect(out[1]).toBe(Array(11).fill("가").join("|"));
	});

	it("E8: 줄이 꽉 찬 상태의 띄어쓰기는 버리고 다음 줄 첫 칸부터 쓴다", () => {
		// 들여쓰기 1 + 19자 = 20칸이 꽉 참. 그 뒤 공백은 사라진다.
		const out = lines(`${"가".repeat(19)} 나`);
		expect(out[0]).toBe(["·", ...Array(19).fill("가")].join("|"));
		expect(out[1]).toBe("나");
	});

	it("띄어쓰기는 줄 첫 칸에 오지 않는다", () => {
		const out = lines(`${"가".repeat(25)} 나`);
		expect(out[1].startsWith("·")).toBe(false);
	});

	it("E9: 줄 끝에 자리가 없는 마침표는 마지막 칸에 글자와 함께 넣는다", () => {
		const out = lines(`${"가".repeat(19)}.`);
		expect(out[0].endsWith("가.")).toBe(true);
		expect(out).toHaveLength(1);
	});

	it("E10: 부호가 연달아 넘칠 때 마지막 칸에 함께 쌓인다", () => {
		const out = lines(`"${"가".repeat(18)}."`);
		expect(out[0].endsWith('가."')).toBe(true);
		expect(out).toHaveLength(1);
	});

	it("닫는 부호는 새 줄 첫 칸에 오지 않는다", () => {
		for (const punct of [".", ",", "?", "!"]) {
			const out = lines(`${"가".repeat(19)}${punct}`);
			expect(out).toHaveLength(1);
		}
	});

	it("E11: 여는 따옴표가 마지막 칸이면 그 칸을 비우고 다음 줄로 밀어낸다", () => {
		// 들여쓰기 1 + 18자 = 19칸. 다음 칸(20번째)이 여는 따옴표가 된다.
		const out = lines(`${"가".repeat(18)}"나"`);
		expect(out[0]).toBe(["·", ...Array(18).fill("가"), "·"].join("|"));
		expect(out[1]).toBe('"|나|"');
	});

	it("E15: 2칸 부호가 줄 끝에 걸치면 통째로 다음 줄로 옮긴다", () => {
		// 들여쓰기 1 + 18자 = 19칸. 줄임표 2칸이 들어갈 자리가 없다.
		const out = lines(`${"가".repeat(18)}……`);
		expect(out[0]).toBe(["·", ...Array(18).fill("가")].join("|"));
		expect(out[1]).toBe("…|…");
	});

	it("모든 줄은 20칸을 넘지 않는다", () => {
		const text =
			'그는 "왜 그랬을까?" 하고 12345 Korea…… 물었다. 아주 긴 문장이다.';
		const { pages } = layout(text.repeat(5));
		for (const page of pages) {
			for (const line of page.lines) {
				expect(line.cells.length).toBeLessThanOrEqual(COLS);
			}
		}
	});
});

describe("문단·페이지", () => {
	it("문단이 바뀌면 새 줄에서 첫 칸을 비우고 시작한다", () => {
		const out = lines("가나\n다라");
		expect(out[0]).toBe("·|가|나");
		expect(out[1]).toBe("·|다|라");
	});

	it("빈 줄도 문단 구분이다 — Enter를 두 번 쳐도 결과가 같다", () => {
		expect(lines("가나\n\n다라")).toEqual(lines("가나\n다라"));
		expect(lines("가나\n\n\n\n다라")).toHaveLength(2);
	});

	it("빈 줄이 원고지 위에 빈 줄로 남지는 않는다", () => {
		const { pages } = layout("가나\n\n다라");
		expect(pages[0].lines[1].cells.length).toBeGreaterThan(0);
	});

	it("문단 앞뒤 공백은 들여쓴 칸 뒤에 빈 칸을 만들지 않는다", () => {
		expect(lines("   가나   ")[0]).toBe("·|가|나");
	});

	it("줄바꿈 한 번과 빈 줄을 똑같이 문단 구분으로 본다", () => {
		expect(parseBlocks("가\n나\n\n다\r\n\r\n라").map((b) => b.text)).toEqual([
			"가",
			"나",
			"다",
			"라",
		]);
		expect(parseBlocks("   \n\t\n")).toEqual([]);
	});

	it("E23: 10줄을 넘으면 다음 장으로 넘어간다", () => {
		const { pages, stats } = layout("가".repeat(400));
		expect(pages.length).toBeGreaterThan(1);
		expect(stats.lines).toBeGreaterThan(10);
	});

	it("빈 문서도 빈 원고지 한 장은 나온다", () => {
		const { pages, stats } = layout("");
		expect(pages).toHaveLength(1);
		expect(stats.filledCells).toBe(0);
		expect(pages[0].lines).toHaveLength(10);
	});

	it("매수는 공백 포함 200자 기준으로 올림한다", () => {
		expect(layout("가".repeat(200)).stats.sheets).toBe(1);
		expect(layout("가".repeat(201)).stats.sheets).toBe(2);
	});
});

describe("빈 행", () => {
	const para = (text: string) => ({ type: "paragraph", text }) as const;
	const blank = { type: "blankRow" } as const;

	it("빈 행 블록은 20칸이 모두 빈 줄이 된다", () => {
		const { pages } = layoutBlocks([para("가나"), blank, para("다라")]);
		expect(pages[0].lines[0].cells.length).toBeGreaterThan(0);
		expect(pages[0].lines[1].cells).toHaveLength(0);
		expect(pages[0].lines[2].cells.length).toBeGreaterThan(0);
	});

	it("빈 행은 줄 하나를 소모한다", () => {
		expect(layoutBlocks([para("가"), para("다")]).stats.lines).toBe(2);
		expect(layoutBlocks([para("가"), blank, para("다")]).stats.lines).toBe(3);
	});

	it("장의 맨 위에 오는 빈 행은 버린다", () => {
		// 10줄을 채운 직후의 빈 행은 다음 장 첫 줄이 되므로 사라진다
		const { stats } = layoutBlocks([para("가".repeat(199)), blank, para("다")]);
		expect(stats.lines).toBe(11);
	});

	it("끝에 매달린 빈 행은 장 수를 부풀리지 않는다", () => {
		expect(layoutBlocks([para("가"), blank, blank]).stats.lines).toBe(1);
	});

	it("빈 행은 글자 수에 세지 않는다", () => {
		expect(layoutBlocks([para("가나"), blank, para("다라")]).stats.chars).toBe(
			layoutBlocks([para("가나"), para("다라")]).stats.chars,
		);
	});

	it("평문에는 빈 행 표기법이 없다 — 하이픈은 본문 그대로다", () => {
		expect(parseBlocks("---")).toEqual([{ type: "paragraph", text: "---" }]);
		expect(lines("가--나")[0]).toBe("·|가|―|―|나");
	});
});

describe("대화문", () => {
	it("따옴표는 각각 한 칸을 차지한다", () => {
		expect(cellCount('"가"')).toBe(3);
	});

	it("아포스트로피는 따옴표로 세지 않는다", () => {
		expect(lines("don't")[0]).toBe("·|do|n|'|t");
	});

	it("대화문은 줄이 바뀌어도 첫 칸을 계속 비운다", () => {
		// 따옴표 1 + 22자 → 두 줄에 걸친다
		const out = lines(`"${"가".repeat(22)}"`);
		expect(out[0]).toBe(["·", '"', ...Array(18).fill("가")].join("|"));
		// 둘째 줄도 첫 칸이 비어 있다 — 보통 문단이면 첫 칸부터 채운다
		expect(out[1]).toBe(["·", "가", "가", "가", "가", '"'].join("|"));
	});

	it("보통 문단은 둘째 줄부터 첫 칸을 채운다", () => {
		const out = lines("가".repeat(23));
		expect(out[1].startsWith("·")).toBe(false);
	});

	it("작은따옴표로 시작해도 대화문이다", () => {
		const out = lines(`'${"나".repeat(22)}'`);
		expect(out[1].startsWith("·")).toBe(true);
	});

	it("대화문이 끝나면 다음 문단은 보통 문단으로 돌아간다", () => {
		const out = lines(`"짧은 대화."\n${"다".repeat(23)}`);
		expect(out[1]).toBe(["·", ...Array(19).fill("다")].join("|"));
		expect(out[2].startsWith("·")).toBe(false);
	});

	it("들여쓴 칸 바로 뒤의 띄어쓰기는 버린다", () => {
		// 줄이 넘어간 자리에 공백이 오면 들여쓰기 뒤에 빈 칸이 하나 더 생기면 안 된다
		const out = lines(`"${"가".repeat(18)} 나다라"`);
		expect(out[1]).toBe(["·", "나", "다", "라", '"'].join("|"));
	});

	it("대화가 많으면 조판 줄 수가 늘어난다 — 매수 계산에 영향을 준다", () => {
		const dialogue = Array.from(
			{ length: 10 },
			() => '"짧은 대화입니다."',
		).join("\n");
		const { stats } = layout(dialogue);
		expect(stats.lines).toBe(10);
	});
});
