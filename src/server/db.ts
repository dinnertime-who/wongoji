import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/index";

/**
 * D1 손잡이 한 벌.
 *
 * better-auth도 보관함도 같은 것을 쓴다. 두 벌을 만들면 같은 요청 안에서 서로
 * 다른 연결을 잡는다.
 *
 * D1 바인딩은 요청 컨텍스트 안에서만 **질의할** 수 있지만, `env.DB`를 참조하는
 * 것과 그것으로 묻는 것은 다르다. `drizzle()`은 만들어질 때 아무것도 묻지 않으므로
 * 여기 최상단에서 조립해도 된다.
 */
export const db = drizzle(env.DB, { schema });
