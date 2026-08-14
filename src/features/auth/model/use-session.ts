import { authClient } from "#/shared/api/auth-client";

export type { SessionUser } from "#/shared/api/session";
export { useSessionUser, useUserId } from "#/shared/api/session";

/**
 * 지금 로그인한 사람은 `useSessionUser`가 답한다 — **서버가 첫 HTML에 실어 보낸
 * 답이라 기다릴 것이 없다.** 그것이 `shared`에 사는 이유는 보관함
 * (`entities/archive`)도 같은 것을 물어야 하고, entities는 features를 부를 수
 * 없어서다.
 *
 * 이 슬라이스에 남은 것은 **드나드는 일**이다. better-auth 클라이언트를 직접
 * 만지는 곳을 여기 하나로 두면, 나중에 제공자가 늘어도 부르는 쪽은 그대로다.
 */

/** 구글 동의 화면으로 보낸다. 돌아오는 곳은 지금 보던 쪽. */
export function signInWithGoogle() {
	return authClient.signIn.social({
		provider: "google",
		callbackURL: window.location.pathname,
	});
}

export function signOut() {
	return authClient.signOut();
}
