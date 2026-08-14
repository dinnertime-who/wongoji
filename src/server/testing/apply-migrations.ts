import { applyD1Migrations, env } from "cloudflare:test";

/**
 * 테스트용 D1에 **진짜 마이그레이션을 올린다.**
 *
 * `drizzle/`에 있는 SQL 그대로다(`vitest.config.ts`가 읽어 바인딩으로 넣어 준다).
 * 손으로 옮겨 적은 `CREATE TABLE`을 쓰면 두 벌이 되고, 그때부터 테스트는 통과하는데
 * 배포본만 깨지는 자리가 생긴다 — 컬럼을 늘리고 마이그레이션을 안 뽑았을 때가 그렇다.
 *
 * 테스트 파일마다 저장소가 갈리므로 여기서 매번 올린다.
 */
await applyD1Migrations(env.DB, env.MIGRATIONS);
