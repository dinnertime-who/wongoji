/**
 * 테스트가 쓰는 빈 워커.
 *
 * `wrangler.jsonc`의 `main`은 react-start가 만들어 주는 진입점을 가리키는데
 * (`@tanstack/react-start/server-entry`), pool-workers는 그것을 파일 경로로 알고
 * 찾다가 실패한다. 여기서 보는 것은 앱이 아니라 `archive.ts`의 함수들이라 진짜
 * 진입점이 필요 없다 — D1 바인딩만 있으면 된다.
 *
 * 라우트를 두드리는 테스트를 쓰게 되면 그때 이 자리를 진짜 진입점으로 바꾼다.
 */
export default {
	fetch: () => new Response("테스트용 빈 워커", { status: 404 }),
};
