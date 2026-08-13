/**
 * 200자 원고지 조판 엔진 — 자료구조
 *
 * 규칙 근거는 docs/wongoji-rules.md 참조.
 * 한 칸에 2~3글리프가 들어가는 케이스(숫자 2자, 줄 끝 부호 병합, 닫는 따옴표+마침표)가
 * 규칙 자체에 내장되어 있으므로 셀 모델은 반드시 `glyphs: string[]`이다.
 */

/** 200자 원고지: 한 줄 20칸 */
export const COLS = 20;
/** 200자 원고지: 한 장 10줄 */
export const ROWS = 10;
/** 원고지 한 장의 칸 수 */
export const CELLS_PER_SHEET = COLS * ROWS;

export type CellKind =
	/** 한글·한자 등 1글자 1칸 */
	| "char"
	/** 아라비아 숫자 (한 칸에 최대 2자) */
	| "digit"
	/** 알파벳 (대문자 1자 / 소문자 2자) */
	| "latin"
	/** 문장부호 */
	| "punct"
	/** 띄어쓰기 */
	| "space"
	/** 줄표·줄임표처럼 2칸을 차지하는 부호의 각 반쪽 */
	| "wide"
	/** 들여쓰기 등으로 의도적으로 비운 칸 */
	| "empty";

/** 원고지 한 칸. glyphs가 2개 이상이면 한 칸에 여러 글리프가 들어간 것. */
export interface Cell {
	glyphs: string[];
	kind: CellKind;
	/**
	 * 줄 끝에서 앞 글자와 합쳐진 문장부호(TOPIK 7항).
	 * 렌더러가 글자를 칸 안에서 좁혀 그릴 때 쓴다.
	 */
	merged?: boolean;
}

/** 원고지 한 줄. 길이는 최대 COLS. */
export interface Line {
	cells: Cell[];
}

/** 원고지 한 장. 길이는 최대 ROWS. */
export interface Page {
	lines: Line[];
}

export interface LayoutStats {
	/** 공백 포함 글자 수 (원문 기준) */
	chars: number;
	/** 실제로 채워진 칸 수 (빈 칸·들여쓰기 제외) */
	filledCells: number;
	/** 조판 결과가 차지한 줄 수 */
	lines: number;
	/**
	 * 원고지 매수 — **실제로 조판된 장 수다.**
	 *
	 * 전에는 `공백 포함 글자 수 ÷ 200`이었다. 그것이 온라인 계산기 다수가 쓰는
	 * 방식이지만, **응모자가 보는 숫자는 한글(HWP)이 주는 것**이고 한글은
	 * "원고지에 옮겨 쓰는 것을 가정하여" 센다 — 조판 기준이다.
	 *
	 * 둘은 문체에 따라 크게 벌어진다. 실측으로 산문 4%, 대화 섞인 소설 18%,
	 * 대화 위주 71%까지 차이가 났다. 문단마다 첫 칸을 비우고 마지막 줄의 남는
	 * 칸이 버려지기 때문이다. **적게 세는 쪽으로 어긋나므로**, 요강에 맞춰 썼다고
	 * 믿은 원고가 실제로는 분량을 넘긴다. 근거는 `docs/contest-features.md`.
	 *
	 * 미리보기의 쪽 번호와 같은 값이다. 둘이 다른 값이던 시절에는 화면에 `매`와
	 * `장`이 나란히 떠서 어느 것이 규정 숫자인지 알 수 없었다.
	 */
	sheets: number;
}

export interface LayoutResult {
	pages: Page[];
	stats: LayoutStats;
	/**
	 * 블록이 어느 장에서 시작하는가. 입력 블록과 같은 차례로 늘어선다.
	 *
	 * **칸까지 짚지 않는다.** 커서가 있는 문단이 몇 장째인지만 알면 미리보기를
	 * 그 장으로 옮길 수 있고, 칸 단위 대응은 `Cell`마다 출처를 달아야 해서
	 * 엔진과 렌더러가 함께 무거워진다. 지금 필요한 것은 장 하나다.
	 */
	blockPages: number[];
}

/**
 * 조판 엔진의 입력 단위.
 *
 * 에디터가 이미 문단/빈 행을 구조로 알고 있으므로 문자열로 납작하게 만들지 않고
 * 이 형태로 넘긴다. 운문·인용 블록도 나중에 여기에 붙는다.
 */
export type Block =
	| { type: "paragraph"; text: string }
	/** 20칸이 전부 빈 행 하나. 운문의 연 사이, 60자 이상 긴 인용의 위아래에 쓴다. */
	| { type: "blankRow" };

/** 토큰이 배치 단계에서 어떻게 취급되는지 */
export type TokenRole =
	/** 일반 글자 */
	| "text"
	/** 띄어쓰기 — 줄 첫 칸에 올 수 없다 */
	| "space"
	/** 닫는 성격의 부호 — 줄 첫 칸에 올 수 없다. 자리가 없으면 앞 칸에 합친다 */
	| "closer"
	/** 여는 성격의 부호 — 줄 마지막 칸에 올 수 없다. 다음 줄로 밀어낸다 */
	| "opener";

/** 배치 단계에 넘겨지는 단위. cells.length가 1이면 1칸, 2면 2칸을 차지한다. */
export interface Token {
	cells: Cell[];
	role: TokenRole;
	/** 2칸 부호처럼 줄 경계에서 쪼개면 안 되는 토큰 */
	atomic?: boolean;
}
