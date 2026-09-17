import { and, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import {
	isAnnouncementActive,
	TEMPLATE_DOWNLOAD_ANNOUNCEMENT,
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
				eq(
					announcementDismissal.announcementId,
					TEMPLATE_DOWNLOAD_ANNOUNCEMENT.id,
				),
			),
		)
		.limit(1);

	return dismissal || !isAnnouncementActive()
		? null
		: TEMPLATE_DOWNLOAD_ANNOUNCEMENT;
}

export async function dismissAnnouncement(db: Db, userId: string) {
	await db
		.insert(announcementDismissal)
		.values({ userId, announcementId: TEMPLATE_DOWNLOAD_ANNOUNCEMENT.id })
		.onConflictDoNothing();
}
