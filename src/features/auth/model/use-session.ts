import { authClient } from "#/shared/api/auth-client";

/**
 * 지금 로그인한 사람. 로그인하지 않았으면 `data`가 null이다.
 *
 * better-auth가 주는 훅을 그대로 내보낸다. 한 겹 씌우는 대신 이름만 이 슬라이스
 * 것으로 바꿔 두는 것은, 나중에 세션에 앱 고유의 것을 얹게 되면 부르는 쪽을
 * 고치지 않고 여기만 고치기 위해서다.
 */
export const useSession = authClient.useSession;

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
