/// <reference types="@cloudflare/vitest-pool-workers/types" />

/**
 * 테스트가 받는 바인딩.
 *
 * 배포본의 것(`Cloudflare.Env` — wrangler가 `wrangler.jsonc`를 보고 뽑는다)에
 * 마이그레이션 한 벌이 더 얹힌다. 그것만 테스트용이고 나머지는 그 파일에서
 * 그대로 온다.
 *
 * 위의 참조가 있어야 `cloudflare:test`의 `env`·`applyD1Migrations`가 보인다.
 * 참조 없이 `declare module`을 열기만 하면 그것들이 **없는 모듈**이 되어 버린다.
 */
declare namespace Cloudflare {
	interface Env {
		MIGRATIONS: import("@cloudflare/vitest-pool-workers").D1Migration[];
	}
}
