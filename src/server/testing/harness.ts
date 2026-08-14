import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { auth } from "../auth";
import { user } from "../schema/auth";
import * as schema from "../schema/index";

/**
 * 서버 테스트가 함께 쓰는 밑판.
 *
 * **진짜 D1과 진짜 세션을 쓴다.** workerd 안에서 `drizzle/`의 마이그레이션을
 * 그대로 올린 것이고(`vitest.config.ts`의 `d1` 프로젝트), 로그인도 better-auth를
 * 실제로 지나 만든 쿠키다. 흉내 낸 것을 쓰면 흉내가 검사된다 — 이 하네스를 처음
 * 돌렸을 때 외래 키 제약이 바로 걸렸고, 그것이 흉내로는 나오지 않았을 실패다.
 *
 * `src/server/`와 `src/routes/`의 테스트가 함께 부른다.
 */

export const db = drizzle(env.DB, { schema });

/**
 * 계정 하나를 줄만 넣어 만든다.
 *
 * 보관함 행은 전부 계정에 매달려 있어(외래 키) 없는 사람으로는 원고를 만들 수
 * 없다. 세션이 필요 없는 자리 — `archive.ts`의 함수를 곧장 부르는 테스트가
 * 그렇다 — 에서는 이쪽이 싸다.
 *
 * **테스트마다 다른 사람을 쓴다.** 그래야 서로의 보관함을 보지 않고, 계정 칸이
 * 갈리는지도 함께 검사된다.
 */
export async function 사람(id: string): Promise<string> {
	await db
		.insert(user)
		.values({ id, name: id, email: `${id}@test.local`, emailVerified: false })
		.onConflictDoNothing();
	return id;
}

/**
 * 로그인한 계정 하나. **better-auth를 실제로 지난다.**
 *
 * 이메일·비밀번호는 개발 서버에서만 열려 있는데(`auth.ts`의 `import.meta.env.DEV`)
 * 테스트도 그 안이라 쓸 수 있다. 세션 줄을 손으로 넣지 않는 이유는, 그러면 쿠키
 * 서명과 만료 규칙을 우리가 다시 구현하게 되기 때문이다 — 그 규칙이 틀렸는지
 * 보려고 라우트를 두드리는 것인데 앞뒤가 바뀐다.
 */
let 몇번째 = 0;

export async function 계정(
	name: string,
): Promise<{ userId: string; cookie: string }> {
	몇번째 += 1;
	const response = await auth.api.signUpEmail({
		body: {
			name,
			/*
			 * 주소는 세어서 짓는다. **이름을 그대로 쓰지 않는다** — 여기 이름은
			 * 읽으라고 한글로 적는데, better-auth가 주소 모양을 보고 400으로 돌려준다.
			 */
			email: `t${몇번째}@test.local`,
			// 개발 계정이다. 이 값은 테스트 안에서만 산다
			password: "test-password-1234",
		},
		asResponse: true,
	});

	const cookie = response.headers.get("set-cookie");
	if (!response.ok || !cookie) {
		throw new Error(`가입하지 못했다 (${response.status})`);
	}

	const { user: made } = (await response.json()) as { user: { id: string } };
	// 브라우저가 보내는 모양으로 줄인다 — 이름=값만 남기고 속성은 뗀다
	return { userId: made.id, cookie: cookie.split(";")[0] ?? "" };
}

/**
 * 요청 하나를 짓는다.
 *
 * `cookie`를 주지 않으면 **로그인하지 않은 요청**이다. 계정 보관함이 계정 없이
 * 열리지 않는지 보는 자리라 그쪽도 꼭 두드린다.
 */
export function 요청(
	path: string,
	{
		method = "GET",
		cookie,
		body,
	}: { method?: string; cookie?: string; body?: unknown } = {},
): Request {
	return new Request(`${env.BETTER_AUTH_URL}${path}`, {
		method,
		headers: {
			...(cookie ? { cookie } : {}),
			...(body !== undefined ? { "Content-Type": "application/json" } : {}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

/** Tiptap 문서 한 벌. 본문이 필요할 때 쓴다 */
export const 글 = (text: string) => ({
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

type Handler = (ctx: {
	request: Request;
	params: Record<string, string>;
}) => Promise<Response>;

/**
 * 라우트의 서버 핸들러를 꺼낸다.
 *
 * `createFileRoute`가 내놓는 타입은 "핸들러 묶음이거나 그것을 만드는 함수"라
 * 곧바로 꺼내지지 않는다. 우리 라우트는 전부 묶음 쪽이므로 **여기서 한 번만**
 * 좁힌다 — 테스트마다 캐스팅이 흩어지면 라우트 모양이 바뀌어도 아무도 모른다.
 */
export const 핸들러 = (route: {
	options: { server?: { handlers?: unknown } };
}): Record<string, Handler> =>
	(route.options.server?.handlers ?? {}) as Record<string, Handler>;
