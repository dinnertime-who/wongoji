/**
 * 규칙 프로파일.
 *
 * 원고지 사용법에는 공인된 표준이 없다 — 국립국어원은 "어문 규정에 규정되어 있지 않으므로
 * 관행을 따르라"고 공식 답변한다. 자료마다 규칙이 실제로 충돌하므로 프로파일로 분리한다.
 * 자세한 근거와 충돌 목록은 docs/wongoji-rules.md 참조.
 *
 * v1은 `topik` 하나만 구현한다. TOPIK 공식 7개 항이 유일하게 자기모순 없이
 * 알고리즘화 가능한 준(準)공식 문서이기 때문이다.
 */

export interface Profile {
	id: string;
	label: string;

	/**
	 * 한 자리 숫자도 다음 숫자와 묶어 한 칸에 2자씩 쓸지.
	 * TOPIK 4항은 예외를 두지 않는다("아라비아 숫자는 한 칸에 두 자씩 쓴다").
	 * 학교 글짓기 계열 자료는 한 자리 숫자를 1칸 1자로 쓴다 → 프로파일로 갈린다.
	 */
	pairSingleDigit: boolean;

	/**
	 * 물음표·느낌표 뒤에 한 칸을 비운다 (TOPIK 6항).
	 * 단 바로 뒤에 닫는 따옴표가 오면 비우지 않는다.
	 */
	spaceAfterQuestionExclaim: boolean;

	/**
	 * 온점·반점·쌍점 뒤의 띄어쓰기를 지운다.
	 * TOPIK 6항은 "비우지 않아도 된다", 글로벌 세계 대백과사전은
	 * "그 다음 칸은 비우지 않는 것이 보통"이라 한다.
	 */
	dropSpaceAfterPeriod: boolean;

	/**
	 * 여는 따옴표·괄호가 줄 마지막 칸에 오면 그 칸을 비우고 다음 줄로 밀어낸다.
	 * TOPIK은 이 경우를 언급하지 않는다. 글나라(어린이용 13)의 규칙을 채택했다.
	 * 끄면 여는 부호도 마지막 칸에 그대로 들어간다.
	 */
	pushOpenerToNextLine: boolean;

	/**
	 * 2칸 부호(줄표·줄임표)가 줄 끝에 걸치면 통째로 다음 줄로 옮긴다.
	 * 어느 자료에도 근거가 없는 구현 판단이다(docs E15). 끄면 줄을 넘어 쪼개진다.
	 */
	keepWidePunctTogether: boolean;

	/**
	 * 소속·이름을 오른쪽에 붙일 때 끝에서 비우는 칸 수.
	 * 자료마다 1~3칸으로 갈린다. 2칸이 가장 흔하다(docs 2.4).
	 */
	affiliationTailGap: number;
}

export const TOPIK_PROFILE: Profile = {
	id: "topik",
	label: "TOPIK 공식",
	pairSingleDigit: true,
	spaceAfterQuestionExclaim: true,
	dropSpaceAfterPeriod: true,
	pushOpenerToNextLine: true,
	keepWidePunctTogether: true,
	affiliationTailGap: 2,
};

export const DEFAULT_PROFILE = TOPIK_PROFILE;
