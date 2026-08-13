import { describe, expect, it } from "vitest";
import { layout, layoutBlocks, parseBlocks } from "./layout";
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
		expect(stats.sheets).toBe(1);
		expect(stats.filledCells).toBe(0);
		expect(pages[0].lines).toHaveLength(10);
	});

	/*
	 * 매수는 **조판해 보고 센다.** 글자 수를 200으로 나누지 않는다.
	 *
	 * 응모자가 보는 숫자는 한글(HWP)이 주는 것이고, 한글은 "원고지에 옮겨 쓰는
	 * 것을 가정하여" 센다. 나누기로 세면 적게 나오는 쪽으로 어긋나서, 요강에
	 * 맞춰 썼다고 믿은 원고가 실제로는 분량을 넘긴다.
	 */
	it("매수는 조판된 장 수다 — 200으로 나눈 값이 아니다", () => {
		// 한 문단 200자는 들여쓰기 한 칸이 붙어 201칸을 먹는다 → 11줄 → 2장
		const one = layout("가".repeat(200)).stats;
		expect(one.chars).toBe(200);
		expect(one.lines).toBe(11);
		expect(one.sheets).toBe(2);
	});

	it("글자 수가 같아도 문단이 잦으면 매수가 는다", () => {
		// 문단마다 첫 칸을 비우고 마지막 줄의 남는 칸이 버려진다. 대화가 많은
		// 소설일수록 이 낭비가 커진다 — 실측으로 최대 71%까지 벌어졌다
		const 통짜 = layout("가".repeat(400)).stats;
		const 잘게 = layout(
			Array.from({ length: 20 }, () => "가".repeat(20)).join("\n"),
		).stats;

		expect(잘게.chars).toBe(통짜.chars);
		expect(잘게.sheets).toBeGreaterThan(통짜.sheets);
	});

	it("문단 구분은 글자로 세지 않는다", () => {
		// 문단 사이를 글자로 세면 201자가 된다 — 사람이 친 글자가 아니다
		const 두문단 = `${"가".repeat(100)}\n${"나".repeat(100)}`;
		expect(layout(두문단).stats.chars).toBe(200);
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

describe("블록이 시작하는 장", () => {
	/*
	 * 커서가 멎었을 때 미리보기를 그 장으로 옮기는 데 쓴다. 칸까지 짚지 않고
	 * 장 하나만 알면 되는 것이 이 대응의 요점이다.
	 */
	it("문단마다 어느 장에서 시작하는지 알려 준다", () => {
		// 20자 문단은 들여쓰기 한 칸이 붙어 21칸 → 두 줄. 한 장이 10줄이므로
		// 다섯 문단마다 장이 넘어간다
		const { blockPages, stats } = layout(
			Array.from({ length: 20 }, () => "가".repeat(20)).join("\n"),
		);

		expect(stats.sheets).toBe(4);
		expect(blockPages).toHaveLength(20);
		expect(blockPages[0]).toBe(0);
		expect(blockPages[4]).toBe(0);
		expect(blockPages[5]).toBe(1);
		expect(blockPages[19]).toBe(3);
	});

	it("없는 장을 가리키지 않는다", () => {
		const { blockPages, pages } = layout("가".repeat(30));
		for (const page of blockPages) {
			expect(page).toBeLessThan(pages.length);
			expect(page).toBeGreaterThanOrEqual(0);
		}
	});
});
