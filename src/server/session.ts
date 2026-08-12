import { auth } from "./auth";

/**
 * 이 요청을 보낸 사람.
 *
 * 보관함 라우트는 전부 이것으로 시작한다. 로그인하지 않았으면 null이고, 그때
 * 하는 일은 401을 돌려주는 것 하나뿐이다 — 계정 보관함은 계정이 있어야 있다.
 */
export async function currentUserId(request: Request): Promise<string | null> {
	const session = await auth.api.getSession({ headers: request.headers });
	return session?.user?.id ?? null;
}

/** 로그인하지 않은 요청에 돌려줄 것 */
export const unauthorized = () =>
	Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
