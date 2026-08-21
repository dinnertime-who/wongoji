import { describe, expect, test } from "vitest";
import { FAQ, FEATURES, LANDING_HEADING, LANDING_LEAD } from "./landing";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_TITLE } from "./site";

/**
 * 홈의 본문이 제 노릇을 하는가.
 *
 * **여기서 깨지지 않으면 아무 데서도 안 깨진다는 것이 문제다.** 소개 문단을
 * 실수로 비워도 화면은 멀쩡히 그려지고 타입도 통과하는데, 그 순간 `/`는 다시
 * 크롤러에게 빈 쪽이 된다. 되돌아오는 신호는 몇 주 뒤 검색 순위뿐이다.
 */
describe("홈 소개", () => {
	test("제목과 첫 문단이 비어 있지 않다", () => {
		expect(LANDING_HEADING.length).toBeGreaterThan(0);
		// 한 문단은 되어야 본문 대접을 받는다
		expect(LANDING_LEAD.length).toBeGreaterThan(80);
	});

	test("기능과 문답이 남아 있다", () => {
		expect(FEATURES.length).toBeGreaterThanOrEqual(4);
		expect(FAQ.length).toBeGreaterThanOrEqual(4);
	});

	test("문답의 답이 구조화 데이터로 나갈 만큼 갖춰져 있다", () => {
		for (const { q, a } of FAQ) {
			// 물음표가 없으면 물음이 아니다 — 구글이 Question으로 읽지 않는다
			expect(q).toMatch(/\?$/);
			expect(a.length).toBeGreaterThan(30);
		}
	});

	test("같은 물음을 두 번 싣지 않는다", () => {
		const asked = FAQ.map((f) => f.q);
		expect(new Set(asked).size).toBe(asked.length);
	});
});

/**
 * 노리는 검색어가 **쪽 안에** 있는가.
 *
 * 메타 태그에만 있으면 걸리지 않는다. 메타는 이미 찾은 쪽을 어떻게 소개할지를
 * 정할 뿐이라, 본문에 그 말이 없으면 구글은 이 쪽을 그 질의의 답으로 보지 않는다.
 * `/`가 오래 그런 쪽이었다 — 빈 에디터와 격자뿐이었다.
 *
 * 그래서 화면에 그려지는 글에서 찾는다. 메타를 아무리 고쳐도 이 검사는 통과하지
 * 않는다.
 */
describe("노리는 검색어", () => {
	/** 홈이 걸려야 하는 말. 여기 있는 것은 전부 사람이 검색창에 치는 그대로다 */
	const WANTED = [
		"원고지",
		"원고지 작성",
		"온라인 원고지",
		"원고지 작성 사이트",
		"설치",
		"회원가입",
		"매수",
	];

	/** 쪽에 실제로 그려지는 글 전부 */
	const body = [
		LANDING_HEADING,
		LANDING_LEAD,
		...FEATURES.flatMap((f) => [f.title, f.body]),
		...FAQ.flatMap((f) => [f.q, f.a]),
	].join(" ");

	for (const term of WANTED) {
		test(`본문에 "${term}"이(가) 있다`, () => {
			expect(body).toContain(term);
		});
	}

	test("제목·설명이 본문과 같은 말을 쓴다", () => {
		// 제목에 있는 말이 본문에 없으면 구글이 제목을 제 것으로 갈아 쓴다
		expect(SITE_TITLE).toContain("온라인 원고지 작성 사이트");
		expect(SITE_DESCRIPTION).toContain("설치 없이");
		expect(SITE_KEYWORDS).toContain("원고지 작성 프로그램");
	});
});
