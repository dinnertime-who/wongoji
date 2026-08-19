/*
 * 두 벌을 나눠 둔 이유는 소유자가 다르기 때문이다.
 *
 * `auth.ts`는 better-auth CLI가 만든다 — 손으로 고치면 다음 regenerate에
 * 날아간다. 다시 뽑을 때는 출력을 그 파일로 지정한다:
 *
 *   npx auth generate --adapter drizzle --dialect sqlite \
 *     --output src/server/schema/auth.ts
 *
 * `archive.ts`는 우리 것이다.
 */
export * from "./archive";
export * from "./auth";
export * from "./writing";
