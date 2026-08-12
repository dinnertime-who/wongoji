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
	 * 자체 회원가입은 없다. `emailAndPassword`는 켜지 않으면 꺼진 것이 기본값
	 * 이라 여기서 할 일이 없지만, 빠뜨린 것이 아니라 정한 것임을 적어 둔다.
	 * 계정을 만드는 길은 아래 구글 하나뿐이다.
	 */
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		},
	},
});
