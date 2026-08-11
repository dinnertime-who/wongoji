/**
 * 2·3단계: 토큰 배열 → 줄 배치 → 페이지 배치
 *
 * 배치 로직 전체를 지배하는 제약은 두 줄이다.
 *   1. 줄 첫 칸에는 띄어쓰기와 닫는 부호(`.` `,` `?` `!`)가 올 수 없다.
 *   2. 줄 마지막 칸에는 여는 부호(`“` `‘` `(`)가 올 수 없다.
 * 둘은 방향이 정반대라 분기가 필수다.
 */

import { DEFAULT_PROFILE, type Profile } from "./profile";
import { tokenizeParagraph } from "./tokenize";
import {
	type Block,
	CELLS_PER_SHEET,
	type Cell,
	COLS,
	type LayoutResult,
	type Line,
	type Page,
	ROWS,
	type Token,
} from "./types";

const emptyCell = (): Cell => ({ glyphs: [], kind: "empty" });
const spaceCell = (): Cell => ({ glyphs: [], kind: "space" });
const cloneCell = (c: Cell): Cell => ({ ...c, glyphs: [...c.glyphs] });

/** `---`만 있는 줄은 빈 행 지시자다 */
const BLANK_ROW_MARKER = /^-{3,}$/;

/**
 * 평문을 블록 배열로 파싱한다.
 *
 * 줄바꿈 한 번도, 빈 줄도 모두 문단 구분으로 본다. Enter를 한 번 치든 두 번 치든
 * 결과가 같다는 뜻이다. 원고지에서 문단은 들여쓰기로 표시하지 빈 줄로 표시하지 않으므로
 * 빈 줄 자체는 원고지 위에 남지 않는다. 빈 행이 필요하면 `---`로 명시한다.
 *
 * 문단 앞뒤 공백은 버린다. 남겨두면 들여쓴 첫 칸 다음에 빈 칸이 하나 더 생긴다.
 */
export function parseBlocks(text: string): Block[] {
	return text
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "")
		.map((line) =>
			BLANK_ROW_MARKER.test(line)
				? ({ type: "blankRow" } as const)
				: ({ type: "paragraph", text: line } as const),
		);
}

/** 평문에서 문단 텍스트만 뽑는다. */
export function splitParagraphs(text: string): string[] {
	return parseBlocks(text)
		.filter((b) => b.type === "paragraph")
		.map((b) => b.text);
}

/** 원문을 200자 원고지 위에 조판한다. */
export function layout(
	text: string,
	profile: Profile = DEFAULT_PROFILE,
): LayoutResult {
	return layoutBlocks(parseBlocks(text), profile);
}

/**
 * 블록 배열을 200자 원고지 위에 조판한다.
 *
 * 에디터(Tiptap)와 엔진을 잇는 지점이다. 에디터가 이미 문단/빈 행을 구조로 알고 있으므로
 * 문자열로 납작하게 만들었다 다시 파싱하지 않고 블록 그대로 받는다.
 */
export function layoutBlocks(
	blocks: Block[],
	profile: Profile = DEFAULT_PROFILE,
): LayoutResult {
	// 매수는 본문 글자 수로 센다. `---`는 지시자지 본문이 아니므로 빠진다.
	const normalized = blocks
		.filter((b) => b.type === "paragraph")
		.map((b) => b.text)
		.join("\n");

	const lines: Cell[][] = [];
	let cur: Cell[] = [];

	const flush = () => {
		lines.push(cur);
		cur = [];
	};

	const pushCells = (cells: Cell[]) => {
		for (const c of cells) {
			if (cur.length >= COLS) flush();
			cur.push(cloneCell(c));
		}
	};

	/**
	 * 줄이 꽉 찬 상태에서 닫는 부호가 오면 마지막 칸에 앞 글자와 함께 넣는다 (TOPIK 7항).
	 * "행의 첫머리가 쉼표나 마침표로 시작되면 오히려 어색하기 때문이다."
	 */
	const mergeIntoLast = (token: Token) => {
		const last = cur[cur.length - 1];
		const incoming = token.cells[0];
		if (!last || last.kind === "space" || last.kind === "empty") {
			// 앞 칸이 비어 있으면 합칠 글자가 없다 → 그 칸을 부호로 대체한다.
			cur[cur.length - 1] = cloneCell(incoming);
			return;
		}
		last.glyphs = [...last.glyphs, ...incoming.glyphs];
		last.merged = true;
	};

	const place = (token: Token) => {
		switch (token.role) {
			case "space": {
				// 줄이 꽉 찼으면 띄우지 않고 다음 줄 첫 칸부터 쓴다 (TOPIK 3항)
				if (cur.length >= COLS) {
					flush();
					return;
				}
				// 줄 첫 칸을 비우면 문단 첫머리와 혼동된다
				if (cur.length === 0) return;
				cur.push(spaceCell());
				return;
			}

			case "closer": {
				if (cur.length >= COLS) {
					mergeIntoLast(token);
					return;
				}
				pushCells(token.cells);
				return;
			}

			case "opener": {
				if (profile.pushOpenerToNextLine && cur.length === COLS - 1) {
					cur.push(emptyCell());
					flush();
				}
				pushCells(token.cells);
				return;
			}

			default: {
				// 2칸 부호가 줄 끝에 걸치면 통째로 다음 줄로 옮긴다
				if (
					token.atomic &&
					profile.keepWidePunctTogether &&
					cur.length + token.cells.length > COLS
				) {
					flush();
				}
				pushCells(token.cells);
			}
		}
	};

	for (const block of blocks) {
		if (cur.length > 0) flush();

		if (block.type === "blankRow") {
			// 장의 맨 위에 오는 빈 행은 버린다. 새 장이 빈 줄로 시작하면 낭비다.
			if (lines.length % ROWS !== 0) lines.push([]);
			continue;
		}

		// 문단은 첫 칸을 비우고 둘째 칸부터 (TOPIK 2항)
		cur = [emptyCell()];
		for (const token of tokenizeParagraph(block.text, profile)) place(token);
	}
	if (cur.length > 0) flush();

	// 끝에 매달린 빈 행은 장 수만 부풀린다
	while (lines.length > 0 && lines[lines.length - 1].length === 0) lines.pop();

	const filledCells = lines.flat().filter((c) => c.glyphs.length > 0).length;

	const pages = paginate(lines);

	return {
		pages,
		stats: {
			chars: normalized.length,
			filledCells,
			lines: lines.length,
			pages: pages.length,
			sheets: Math.max(1, Math.ceil(normalized.length / CELLS_PER_SHEET)),
		},
	};
}

/** 10줄씩 끊어 장으로 나눈다. 빈 문서도 빈 원고지 한 장은 나온다. */
function paginate(lines: Cell[][]): Page[] {
	const pages: Page[] = [];
	for (let i = 0; i < lines.length; i += ROWS) {
		pages.push({ lines: lines.slice(i, i + ROWS).map(toLine) });
	}
	if (pages.length === 0) pages.push({ lines: [] });

	// 렌더러가 격자를 일정하게 그릴 수 있도록 마지막 장을 빈 줄로 채운다.
	for (const page of pages) {
		while (page.lines.length < ROWS) page.lines.push({ cells: [] });
	}
	return pages;
}

const toLine = (cells: Cell[]): Line => ({ cells });
