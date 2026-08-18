import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ARTICLES, guideUrls } from "./guide";
import { SITE_URL } from "./site";

/**
 * sitemap이 글 목록과 어긋나지 않는가.
 *
 * **어긋나도 아무것도 깨지지 않는 것이 문제다.** 글을 하나 더하고 sitemap을
 * 빠뜨리면 화면은 멀쩡하고 테스트도 전부 통과하는데, 구글은 그 글을 모른다.
 * 반대로 글을 지우고 sitemap에 남겨 두면 크롤러가 404를 받아 사이트 신뢰가
 * 깎인다. 둘 다 배포하고 몇 주 뒤에나 알게 된다.
 *
 * 그래서 정본(`ARTICLES`)과 내보내는 파일을 여기서 맞대어 본다.
 */
const sitemap = readFileSync("public/sitemap.xml", "utf-8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

describe("sitemap", () => {
	test("홈과 사용법 글이 빠짐없이 실려 있다", () => {
		expect(locs).toEqual([`${SITE_URL}/`, ...guideUrls()]);
	});

	test("sitemap에 없는 주소를 싣지 않는다", () => {
		expect(new Set(locs).size).toBe(locs.length);
	});
});

describe("글 목록", () => {
	test("slug가 겹치지 않는다", () => {
		const slugs = ARTICLES.map((a) => a.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	test("slug는 주소에 그대로 쓸 수 있는 모양이다", () => {
		for (const { slug } of ARTICLES) {
			expect(slug).toMatch(/^[a-z][a-z0-9-]*$/);
		}
	});

	test("검색 결과에 걸리는 문구가 비어 있지 않다", () => {
		for (const a of ARTICLES) {
			expect(a.title.length).toBeGreaterThan(0);
			// 설명이 너무 짧으면 구글이 제 것으로 갈아 쓴다
			expect(a.description.length).toBeGreaterThan(50);
			expect(a.label.length).toBeGreaterThan(0);
			expect(a.summary.length).toBeGreaterThan(0);
		}
	});
});
