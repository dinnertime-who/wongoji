import { fileURLToPath } from "node:url";
import {
	cloudflareTest,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

/**
 * 테스트는 앱의 vite 설정을 쓰지 않는다.
 *
 * `@cloudflare/vite-plugin`은 SSR 환경에 `resolve.external`이 설정되어 있으면
 * 거부하는데, vitest가 바로 그것을 설정한다. 조판 엔진은 프레임워크에 기대지
 * 않으므로 플러그인 없이 그냥 돌리는 편이 맞고, 그러는 편이 빠르기도 하다.
 *
 * **환경으로 두 벌을 가른다.** 파일을 어디에 두느냐가 아니라 무엇을 필요로 하느냐가
 * 기준이다 — `src/server/`는 D1 바인딩이 있어야 돌고, 나머지는 node에서 그냥 돈다.
 * 한 벌로 묶으면 조판 테스트 300줄이 매번 workerd를 띄우고 기다린다.
 */

/*
 * 별칭 두 벌은 tsconfig와 같다. `@`는 벤더링된 shadcn 코드가 쓰는 것이라,
 * 그 코드에 테스트를 붙이려면 여기에도 있어야 한다.
 */
const alias = {
	"#": fileURLToPath(new URL("./src", import.meta.url)),
	"@": fileURLToPath(new URL("./src", import.meta.url)),
};

/*
 * drizzle-kit이 뽑아 둔 SQL 그대로다. **손으로 옮겨 적은 스키마를 쓰지 않는다** —
 * 두 벌이 되는 순간 테스트는 통과하는데 배포본만 깨지는 자리가 생긴다.
 */
const migrations = await readD1Migrations("./drizzle");

/**
 * D1 바인딩이 있어야 도는 것들.
 *
 * `src/routes/`가 함께 든 이유는 API 라우트가 거기 살기 때문이다. 라우트 생성기는
 * `*.test.ts`를 라우트로 치지 않으므로 그 옆에 두어도 된다 — 확인했다.
 */
const NEEDS_D1 = ["src/server/**/*.test.ts", "src/routes/**/*.test.ts"];

export default defineConfig({
	test: {
		projects: [
			{
				resolve: { alias },
				test: {
					name: "unit",
					include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
					exclude: NEEDS_D1,
				},
			},
			{
				plugins: [
					cloudflareTest({
						// 바인딩과 호환 날짜는 **배포하는 것과 같은 파일**에서 온다
						wrangler: { configPath: "./wrangler.jsonc" },
						/*
						 * 진입점만 갈아 끼운다. 그 파일의 `main`은 react-start가 만드는
						 * 것이라 파일 경로가 아니고, 여기서 보는 것은 앱이 아니라 D1을
						 * 다루는 함수들이다.
						 */
						main: "./src/server/testing/no-worker.ts",
						miniflare: { bindings: { MIGRATIONS: migrations } },
					}),
				],
				resolve: { alias },
				test: {
					name: "d1",
					include: NEEDS_D1,
					setupFiles: ["./src/server/testing/apply-migrations.ts"],
				},
			},
		],
	},
});
