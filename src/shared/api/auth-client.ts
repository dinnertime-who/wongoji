import { createAuthClient } from "better-auth/react";

/**
 * 브라우저 쪽 better-auth 클라이언트. 짝인 서버는 `#/server/auth`에 있고,
 * 둘은 코드를 나눠 갖지 않는다 — HTTP로만 만난다.
 *
 * `baseURL`을 적지 않는다. 적지 않으면 현재 origin을 쓴다. 개발(3000)과
 * 배포(workers.dev·커스텀 도메인)가 같은 코드로 돌아가고, 주소를 한 군데
 * 더 관리하지 않아도 된다.
 */
export const authClient = createAuthClient();
