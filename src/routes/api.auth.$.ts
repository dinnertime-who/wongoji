import { createFileRoute } from "@tanstack/react-router";
// createFileRoute의 `server` 옵션은 react-start가 declare module로 얹는다.
// 이 줄이 없으면 타입에 `server`가 없다고 나온다 — 런타임에는 아무것도 안 한다.
import type {} from "@tanstack/react-start";
import { auth } from "#/server/auth";

/**
 * better-auth가 쓰는 모든 주소를 이 한 라우트가 받는다 —
 * `/api/auth/sign-in/social`, `/api/auth/callback/google`, `/api/auth/session` …
 *
 * 라우트는 서버와 화면이 만나는 자리라 `#/server`를 부를 수 있는 유일한 곳이다
 * (biome overrides에서 routes만 열어 뒀다). `server.handlers` 안은 서버에서만
 * 도는 자리이므로 위의 import는 브라우저 번들에 실리지 않는다.
 */
export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => auth.handler(request),
			POST: ({ request }) => auth.handler(request),
		},
	},
});
