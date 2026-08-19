/**
 * 날마다 얼마나 썼는가 — 잔디가 읽는 테이블.
 *
 * 보관함(`archive.ts`)과 나눠 둔 이유는 **가리키는 것이 다르기 때문이다.** 저쪽
 * 행은 원고 하나하나고, 이쪽 행은 하루다. 원고를 지워도 그날 쓴 사실은 남는다 —
 * 오히려 지운 원고에 쏟은 시간이야말로 잔디가 지켜 줘야 하는 것이다.
 */

import { sql } from "drizzle-orm";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/**
 * 하루 한 줄.
 *
 * **날짜가 문자열이다.** 시각(밀리초)으로 두면 읽는 쪽이 다시 어느 시간대로
 * 자를지 정해야 하는데, 그것을 아는 것은 브라우저뿐이다 — 서버는 UTC에 살아서
 * 한국의 새벽 두 시를 전날이라 부른다. 브라우저가 잘라서 보낸 것을 그대로
 * 열쇠로 쓰면 서버는 시간대를 몰라도 되고, **아는 척할 자리도 없다.**
 *
 * 인덱스를 따로 두지 않는다. 열쇠가 `(user_id, day)`라 "이 사람의 이 구간"이
 * 곧 열쇠 접두사 훑기다 — 잔디가 묻는 것이 정확히 그 모양 하나뿐이다.
 */
export const writingDay = sqliteTable(
	"writing_day",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** `"2026-08-19"` — 글을 쓴 사람의 날짜 */
		day: text("day").notNull(),
		/**
		 * 그날 늘어난 글자 수. **음수일 수 있다.**
		 *
		 * 퇴고하면 줄어든다. 0으로 깎아 두면 하루 종일 문장을 덜어낸 사람과 오타
		 * 하나 고친 사람이 같은 줄이 된다.
		 *
		 * **줄이 있다는 것 자체가 "손댔다"는 뜻이다.** 잔디의 바닥 한 칸은 이
		 * 숫자가 아니라 줄의 존재가 정한다(`entities/writing-log/lib/grid.ts`).
		 */
		chars: integer("chars").default(0).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.day] })],
);
