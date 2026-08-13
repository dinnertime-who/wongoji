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
	type Cell,
	COLS,
	type LayoutResult,
	type Line,
	type Page,
	ROWS,
	type Token,
} from "./types";

/**
 * 여는 따옴표로 시작하는 문단은 대화문으로 본다.
 *
 * "대화는 딴 줄을 잡아 쓰되"가 관행이므로, 대화는 제 문단을 갖는다.
 * 따옴표로 시작하는지만 보면 가려낼 수 있다.
 */
const DIALOGUE_START = /^["'“‘]/;

/** 글자가 하나라도 든 줄인가. 들여쓰기 칸만 있는 줄은 빈 줄이다. */
const hasContent = (cells: Cell[]) => cells.some((c) => c.glyphs.length > 0);

const emptyCell = (): Cell => ({ glyphs: [], kind: "empty" });
const spaceCell = (): Cell => ({ glyphs: [], kind: "space" });
const cloneCell = (c: Cell): Cell => ({ ...c, glyphs: [...c.glyphs] });

/**
 * 평문을 블록 배열로 파싱한다.
 *
 * 줄바꿈 한 번도, 빈 줄도 모두 문단 구분으로 본다. Enter를 한 번 치든 두 번 치든
 * 결과가 같다는 뜻이다. 원고지에서 문단은 들여쓰기로 표시하지 빈 줄로 표시하지 않으므로
 * 빈 줄 자체는 원고지 위에 남지 않는다.
 *
 * 평문에는 빈 행을 나타낼 방법이 없다. 빈 행은 에디터에서 버튼으로만 넣으며
 * `layoutBlocks`로 직접 넘어온다. 평문에 표기법을 두면 본문에 쓴 하이픈과 부딪힌다.
 *
 * 문단 앞뒤 공백은 버린다. 남겨두면 들여쓴 첫 칸 다음에 빈 칸이 하나 더 생긴다.
 *
 * 돌려주는 것은 문단뿐이다 — 평문에 빈 행을 적을 방법이 없으므로 타입으로 못박는다.
 */
export function parseBlocks(
	text: string,
): Extract<Block, { type: "paragraph" }>[] {
	return text
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "")
		.map((line) => ({ type: "paragraph", text: line }) as const);
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
	/*
	 * 매수는 쓴 글자 수로 센다. 빈 행은 지시자지 글자가 아니므로 빠진다.
	 *
	 * 문단 사이를 빈 문자열로 잇는다. 줄바꿈을 끼우면 그것까지 글자로 세어져,
	 * 문단이 잦을수록 매수가 부푼다 — 문단 200개면 199자다. 매는 "공백 포함
	 * 글자수 ÷ 200"이고 줄바꿈은 사람이 친 글자가 아니다.
	 */
	const written = blocks
		.filter((b) => b.type !== "blankRow")
		.map((b) => b.text)
		.join("");

	const lines: Cell[][] = [];
	let cur: Cell[] = [];
	/**
	 * 줄이 바뀔 때마다 앞에 비울 칸 수.
	 *
	 * 보통 문단은 0이다 — 첫 줄만 들여쓰고 둘째 줄부터는 첫 칸을 채운다.
	 * 대화문은 1이다 — 따옴표가 끝날 때까지 모든 줄의 첫 칸을 비운다(docs 4.7).
	 */
	let lineIndent = 0;

	const flush = () => {
		lines.push(cur);
		cur = Array.from({ length: lineIndent }, emptyCell);
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
				// 줄 첫 칸을 비우면 문단 첫머리와 혼동된다.
				// 대화문은 들여쓴 칸 바로 뒤도 줄 첫머리로 본다.
				if (cur.length <= lineIndent) return;
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
		// 쓰던 줄을 닫는다. flush()와 달리 다음 줄을 미리 만들지 않는다 —
		// 이어질 블록이 들여쓰기를 새로 정하기 때문이다.
		if (hasContent(cur)) lines.push(cur);
		cur = [];
		lineIndent = 0;

		if (block.type === "blankRow") {
			// 장의 맨 위에 오는 빈 행은 버린다. 새 장이 빈 줄로 시작하면 낭비다.
			if (lines.length % ROWS !== 0) lines.push([]);
			continue;
		}

		// 대화문은 따옴표가 끝날 때까지 모든 줄의 첫 칸을 비운다 (docs 4.7).
		// 보통 문단은 첫 줄만 비운다 (TOPIK 2항).
		lineIndent =
			profile.dialogueHangingIndent && DIALOGUE_START.test(block.text) ? 1 : 0;
		cur = [emptyCell()];
		for (const token of tokenizeParagraph(block.text, profile)) place(token);
	}
	if (hasContent(cur)) lines.push(cur);

	// 끝에 매달린 빈 줄은 장 수만 부풀린다. 들여쓰기 칸만 남은 줄도 빈 줄이다.
	while (lines.length > 0 && !hasContent(lines[lines.length - 1])) lines.pop();

	const filledCells = lines.flat().filter((c) => c.glyphs.length > 0).length;

	const pages = paginate(lines);

	return {
		pages,
		stats: {
			chars: written.length,
			filledCells,
			lines: lines.length,
			// 조판해 보고 센다. 글자 수를 200으로 나누지 않는다 — `LayoutStats` 참고
			sheets: pages.length,
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
