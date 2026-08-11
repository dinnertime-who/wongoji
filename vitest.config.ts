import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * 테스트는 앱의 vite 설정을 쓰지 않는다.
 *
 * `@cloudflare/vite-plugin`은 SSR 환경에 `resolve.external`이 설정되어 있으면
 * 거부하는데, vitest가 바로 그것을 설정한다. 조판 엔진은 프레임워크에 기대지
 * 않으므로 플러그인 없이 그냥 돌리는 편이 맞고, 그러는 편이 빠르기도 하다.
 */
export default defineConfig({
	resolve: {
		alias: {
			"#": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});
