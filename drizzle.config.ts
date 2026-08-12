import { defineConfig } from "drizzle-kit";

/**
 * 표를 만드는 SQL을 뽑는 데만 쓴다. 적용은 wrangler가 한다.
 *
 * drizzle-kit이 D1에 직접 붙으려면 계정 토큰이 따로 필요한데, 그러면 시크릿이
 * 한 벌 늘고 로컬 D1에는 어차피 닿지 못한다. 그래서 여기서는 SQL만 만들고
 * (`pnpm db:generate`), 로컬이든 배포든 `wrangler d1 migrations apply`가
 * 밀어 넣는다 — wrangler.jsonc의 migrations_dir이 이 out을 가리킨다.
 */
export default defineConfig({
	schema: "./src/server/schema/index.ts",
	out: "./drizzle",
	dialect: "sqlite",
});
