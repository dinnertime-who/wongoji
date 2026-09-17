import { sql } from "drizzle-orm";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const announcementDismissal = sqliteTable(
	"announcement_dismissals",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		announcementId: text("announcement_id").notNull(),
		dismissedAt: integer("dismissed_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.announcementId] })],
);
