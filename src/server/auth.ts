/**
 * better-auth 서버 인스턴스.
 *
 * 이 폴더(`src/server/`)는 FSD 바깥이다. 레이어와 슬라이스는 화면을 나누자고
 * 만든 규칙이라, D1 바인딩과 OAuth 시크릿을 쥔 코드에 씌울 이유가 없다.
 * 대신 지켜야 할 선은 하나다 — **여기 있는 것은 브라우저로 넘어가지 않는다.**
 * `cloudflare:workers`가 클라이언트 번들에 실리면 빌드가 깨진다.
 *
 * 그 선은 biome이 지킨다. 프론트 레이어에서 `#/server/**`를 부르면 에러다.
 * 부를 수 있는 곳은 라우트 핸들러뿐이고, 그것도 서버에서만 도는 자리에서다.
 */

import { env } from "cloudflare:workers";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "./db";
import * as schema from "./schema/index";

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite", schema }),
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,

	/*
	 * 자체 회원가입은 없다 — **배포된 앱에서 계정을 만드는 길은 구글 하나뿐이다.**
	 *
	 * 개발 서버에서만 이메일·비밀번호를 연다. 구글 동의 화면은 사람이 눌러야
	 * 지날 수 있어서, 그것 없이는 로그인한 뒤의 흐름(보관함 옮기기, 동기화)을
	 * 자동으로 확인할 방법이 없다.
	 *
	 * `import.meta.env.DEV`는 vite가 빌드할 때 `false`로 **바꿔 박는다.** 그래서
	 * 배포본에서는 이 가지가 죽은 코드가 되어 통째로 사라진다 — 실수로 켜진 채
	 * 나갈 수가 없다. 환경변수로 걸면 그렇지 않다.
	 */
	emailAndPassword: import.meta.env.DEV ? { enabled: true } : undefined,

	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		},
	},
});
