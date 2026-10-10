import { and, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import {
	CURRENT_ANNOUNCEMENT,
	isAnnouncementActive,
} from "#/shared/config/announcement";
import { announcementDismissal } from "./schema/announcement";

type Db = ReturnType<typeof drizzle>;

export async function readAnnouncement(db: Db, userId: string) {
	if (!isAnnouncementActive()) return null;

	const [dismissal] = await db
		.select({ announcementId: announcementDismissal.announcementId })
		.from(announcementDismissal)
		.where(
			and(
				eq(announcementDismissal.userId, userId),
				eq(announcementDismissal.announcementId, CURRENT_ANNOUNCEMENT.id),
			),
		)
		.limit(1);

	return dismissal || !isAnnouncementActive() ? null : CURRENT_ANNOUNCEMENT;
}

export async function dismissAnnouncement(db: Db, userId: string) {
	await db
		.insert(announcementDismissal)
		.values({ userId, announcementId: CURRENT_ANNOUNCEMENT.id })
		.onConflictDoNothing();
}
