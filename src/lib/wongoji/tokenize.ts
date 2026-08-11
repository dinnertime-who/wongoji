/**
 * 1단계: 문자열 → 칸 단위 토큰 배열
 *
 * 이 단계는 "한 칸에 무엇이 들어가는가"만 결정한다.
 * 줄 경계에서 벌어지는 일(부호 병합, 여는 부호 밀어내기)은 layout.ts의 몫이다.
 */

import { DEFAULT_PROFILE, type Profile } from "./profile";
import type { Cell, Token } from "./types";

/** 닫는 성격의 부호 — 줄 첫 칸에 올 수 없다 */
const CLOSERS = new Set([
	".",
	",",
	"?",
	"!",
	":",
	";",
	"”",
	"’",
	")",
	"]",
	"}",
	"」",
	"』",
	"〉",
	"》",
]);

/** 여는 성격의 부호 — 줄 마지막 칸에 올 수 없다 */
const OPENERS = new Set(["“", "‘", "(", "[", "{", "「", "『", "〈", "《"]);

/** 닫는 따옴표 — 물음표·느낌표 뒤 한 칸 비우기의 예외(E13) */
const CLOSING_QUOTES = new Set(["”", "’", '"', "'"]);

/** 뒤에 한 칸을 비우는 부호 (TOPIK 6항) */
const SPACE_AFTER = new Set(["?", "!"]);

/** 뒤를 비우지 않는 부호 (TOPIK 6항) */
const NO_SPACE_AFTER = new Set([".", ",", ":", ";"]);

const cell = (glyphs: string[], kind: Cell["kind"]): Cell => ({ glyphs, kind });

const textToken = (cells: Cell[]): Token => ({ cells, role: "text" });
const spaceToken = (): Token => ({
	cells: [cell([], "space")],
	role: "space",
});
const closerToken = (glyph: string): Token => ({
	cells: [cell([glyph], "punct")],
	role: "closer",
});
const openerToken = (glyph: string): Token => ({
	cells: [cell([glyph], "punct")],
	role: "opener",
});

/** 줄표·줄임표: 2칸을 차지하며 줄 경계에서 쪼개면 안 된다 (TOPIK 5항) */
const wideToken = (glyph: string): Token => ({
	cells: [cell([glyph], "wide"), cell([glyph], "wide")],
	role: "text",
	atomic: true,
});

const isWhitespace = (ch: string) => /\s/.test(ch);
const isAlnum = (ch: string) => /[A-Za-z0-9]/.test(ch);
const isDigit = (ch: string) => /[0-9]/.test(ch);
const isUpper = (ch: string) => /[A-Z]/.test(ch);
const isLower = (ch: string) => /[a-z]/.test(ch);

/**
 * 숫자·알파벳 덩어리를 칸으로 쪼갠다.
 *
 * - 숫자: 앞에서부터 두 자씩 (`123` → `12`/`3`)
 * - 대문자: 1칸 1자
 * - 소문자: 앞에서부터 두 자씩 (`Korea` → `K`/`or`/`ea`)
 * - 숫자와 알파벳이 섞이면 "한 자씩 따로 적는 것을 원칙으로 한다" → 청킹 해제 (E4)
 */
function chunkWord(word: string, profile: Profile): Cell[] {
	const hasDigit = [...word].some(isDigit);
	const hasAlpha = [...word].some((c) => isUpper(c) || isLower(c));

	if (hasDigit && hasAlpha) {
		return [...word].map((c) => cell([c], isDigit(c) ? "digit" : "latin"));
	}

	if (hasDigit) {
		// 한 자리 숫자를 단독으로 쓸지는 프로파일이 정한다.
		if (!profile.pairSingleDigit && word.length === 1) {
			return [cell([word], "digit")];
		}
		return chunkBy2(word).map((g) => cell([...g], "digit"));
	}

	// 알파벳: 대문자는 1자, 소문자 런은 2자씩
	const cells: Cell[] = [];
	let i = 0;
	while (i < word.length) {
		if (isUpper(word[i])) {
			cells.push(cell([word[i]], "latin"));
			i += 1;
			continue;
		}
		let j = i;
		while (j < word.length && isLower(word[j])) j += 1;
		for (const g of chunkBy2(word.slice(i, j))) {
			cells.push(cell([...g], "latin"));
		}
		i = j;
	}
	return cells;
}

function chunkBy2(s: string): string[] {
	const out: string[] = [];
	for (let i = 0; i < s.length; i += 2) out.push(s.slice(i, i + 2));
	return out;
}

/**
 * 한 문단을 토큰 배열로 바꾼다.
 *
 * 문장부호 뒤 띄어쓰기는 여기서 정규화한다. 사용자가 어떻게 입력했든
 * `?`/`!` 뒤에는 한 칸이 생기고, `.`/`,` 뒤의 칸은 사라진다 (TOPIK 6항).
 */
export function tokenizeParagraph(
	text: string,
	profile: Profile = DEFAULT_PROFILE,
): Token[] {
	const tokens: Token[] = [];
	// 곧은따옴표는 여는 것인지 닫는 것인지 글자만으로 알 수 없어 상태로 추적한다.
	let doubleOpen = false;
	let singleOpen = false;
	let i = 0;

	/** 이어지는 공백을 건너뛰고, 건너뛴 게 있으면 true */
	const skipSpaces = () => {
		const start = i;
		while (i < text.length && isWhitespace(text[i])) i += 1;
		return i > start;
	};

	while (i < text.length) {
		const ch = text[i];

		if (isWhitespace(ch)) {
			skipSpaces();
			tokens.push(spaceToken());
			continue;
		}

		// 줄임표 — `.` 검사보다 반드시 먼저 온다
		const ellipsis = /^(…{1,2}|\.{3,6})/.exec(text.slice(i));
		if (ellipsis) {
			tokens.push(wideToken("…"));
			i += ellipsis[0].length;
			continue;
		}

		// 줄표
		const dash = /^(―|—|--)/.exec(text.slice(i));
		if (dash) {
			tokens.push(wideToken("―"));
			i += dash[0].length;
			continue;
		}

		if (isAlnum(ch)) {
			let j = i;
			while (j < text.length && isAlnum(text[j])) j += 1;
			tokens.push(textToken(chunkWord(text.slice(i, j), profile)));
			i = j;
			continue;
		}

		// 곧은따옴표: 상태를 보고 여는 부호/닫는 부호를 가린다.
		// 단 `don't`처럼 글자 사이에 낀 작은따옴표는 아포스트로피로 본다.
		if (ch === '"' || ch === "'") {
			const isApostrophe =
				ch === "'" &&
				i > 0 &&
				i + 1 < text.length &&
				isAlnum(text[i - 1]) &&
				isAlnum(text[i + 1]);
			if (isApostrophe) {
				tokens.push(textToken([cell([ch], "punct")]));
				i += 1;
				continue;
			}
			const open = ch === '"' ? !doubleOpen : !singleOpen;
			if (ch === '"') doubleOpen = !doubleOpen;
			else singleOpen = !singleOpen;
			tokens.push(open ? openerToken(ch) : closerToken(ch));
			i += 1;
			if (!open) handlePostCloser(ch);
			continue;
		}

		if (OPENERS.has(ch)) {
			tokens.push(openerToken(ch));
			i += 1;
			continue;
		}

		if (CLOSERS.has(ch)) {
			tokens.push(closerToken(ch));
			i += 1;
			handlePostCloser(ch);
			continue;
		}

		// 한글·한자 등 그 밖의 모든 글자
		tokens.push(textToken([cell([ch], "char")]));
		i += 1;
	}

	return tokens;

	/** 부호 뒤 띄어쓰기 정규화 */
	function handlePostCloser(glyph: string) {
		if (SPACE_AFTER.has(glyph) && profile.spaceAfterQuestionExclaim) {
			skipSpaces();
			// 닫는 따옴표가 바로 뒤에 오면 비우지 않는다 (E13)
			if (i < text.length && CLOSING_QUOTES.has(text[i])) return;
			// 문단 끝에서는 비울 것이 없다
			if (i >= text.length) return;
			tokens.push(spaceToken());
			return;
		}
		if (NO_SPACE_AFTER.has(glyph) && profile.dropSpaceAfterPeriod) {
			skipSpaces();
		}
	}
}
