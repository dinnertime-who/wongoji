import { and, between, eq, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
/*
 * 배럴이 아니라 모듈을 곧장 부른다. 배럴에는 화면 부품이 함께 실려 있어서,
 * 그것을 부르면 서버 번들이 React까지 끌고 온다 — `archive.ts`가 같은 이유로
 * 같은 길을 쓴다.
 */
import type { WritingLog } from "#/entities/writing-log/model/types";
import { shiftDay } from "#/shared/lib/day";
import { writingDay } from "./schema/writing";

/**
 * 날마다 얼마나 썼는가.
 *
 * **여기 있는 것은 두 줄뿐이다** — 하루치를 더하고, 한 구간을 읽는다. 잔디를
 * 어떻게 그릴지(격자·진하기·연속)는 전부 순수 함수라 `entities/writing-log`에
 * 있고, 브라우저와 이 파일이 같은 것을 본다.
 *
 * **이 파일은 시간대를 모른다.** 날짜는 이미 잘려서 온다(`parseWritingDay`).
 */

type Db = ReturnType<typeof drizzle>;

/**
 * 그날에 얼마를 더한다. **줄이 없으면 만든다.**
 *
 * 더하기(`chars + excluded.chars`)인 것이 요점이다. 하루에 저장은 수백 번 오고
 * 원고도 여러 편이라, 덮어쓰면 마지막 저장 한 번의 증분만 남는다.
 *
 * **`delta`가 0이어도 줄은 만든다.** 오타 하나를 고친 날과 손대지 않은 날은
 * 다르고, 잔디의 바닥 한 칸을 정하는 것이 그 차이다(`grid.ts`).
 *
 * ---
 *
 * **던지지 않는다. 심었는지를 값으로 돌려준다.**
 *
 * 이 함수를 부르는 곳은 원고 본문을 저장하는 길 한복판이다
 * (`api.archive.doc.$docId.ts`). 여기서 던지면 그 요청이 통째로 500이 되고,
 * 브라우저에는 **"원고를 저장하지 못했습니다"** 배너가 뜬다 — 글자를 칠 때마다
 * 한 번씩. 실제로 잃지는 않지만(대기열이 받는다) 사람에게는 원고가 안 저장되는
 * 앱이 된다.
 *
 * 그런 일이 실제로 일어날 수 있는 자리가 있다. **마이그레이션보다 배포가 먼저
 * 나가면 이 테이블이 아직 없다.** 그때 잃는 것은 잔디 한 칸이어야지 그날 쓴
 * 원고가 아니다.
 *
 * 부르는 쪽이 `try`로 감싸게 두지 않은 이유는 하나다 — 그 `try`를 빠뜨리는 날이
 * 오기 때문이다. 규칙을 여기 한 곳에 못박아 둔다.
 */
export async function recordWriting(
	db: Db,
	userId: string,
	day: string,
	delta: number,
	now = Date.now(),
): Promise<boolean> {
	const at = new Date(now);
	try {
		await db
			.insert(writingDay)
			.values({ userId, day, chars: delta, updatedAt: at })
			.onConflictDoUpdate({
				target: [writingDay.userId, writingDay.day],
				set: {
					chars: sql`${writingDay.chars} + ${delta}`,
					updatedAt: at,
				},
			});
		return true;
	} catch {
		// 잔디는 못 심었다. 원고 저장은 이 일과 무관하게 끝나야 한다
		return false;
	}
}

/**
 * 한 구간의 기록. 양 끝을 포함한다.
 *
 * 손대지 않은 날은 줄이 없다 — 없는 것을 0으로 채워 보내지 않는다. 한 해에
 * 365줄을 늘 실어 보낼 이유가 없고, "쉰 날"은 격자를 만들 때 저절로 생긴다.
 */
export async function readWritingLog(
	db: Db,
	userId: string,
	from: string,
	to: string,
): Promise<WritingLog> {
	const rows = await db
		.select({ day: writingDay.day, chars: writingDay.chars })
		.from(writingDay)
		.where(
			and(eq(writingDay.userId, userId), between(writingDay.day, from, to)),
		)
		.orderBy(writingDay.day);

	return rows;
}

/** 잔디가 그리는 만큼. 53주 + 오늘이 낀 주의 앞자리 */
export const GRASS_WEEKS = 53;

/** 격자에 필요한 첫날. 오늘에서 넉넉히 되짚는다 */
export const grassFrom = (today: string): string =>
	shiftDay(today, -(GRASS_WEEKS * 7));
