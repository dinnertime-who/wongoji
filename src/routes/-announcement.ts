import { createServerFn } from "@tanstack/react-start";
import {
	getRequest,
	setResponseHeader,
	setResponseStatus,
} from "@tanstack/react-start/server";
import { dismissAnnouncement, readAnnouncement } from "#/server/announcement";
import { db } from "#/server/db";
import { currentUserId } from "#/server/session";

export const loadAnnouncement = createServerFn({ method: "GET" }).handler(
	async () => {
		setResponseHeader("Cache-Control", "no-store");
		const userId = await currentUserId(getRequest());
		if (!userId) return null;
		return { userId, announcement: await readAnnouncement(db, userId) };
	},
);

export const hideAnnouncement = createServerFn({ method: "POST" }).handler(
	async () => {
		setResponseHeader("Cache-Control", "no-store");
		const request = getRequest();
		if (request.headers.get("origin") !== new URL(request.url).origin) {
			setResponseStatus(403);
			throw new Error("같은 사이트에서 요청해주세요");
		}
		const userId = await currentUserId(request);
		if (!userId) {
			setResponseStatus(401);
			throw new Error("로그인이 필요합니다");
		}
		await dismissAnnouncement(db, userId);
		return { success: true } as const;
	},
);
