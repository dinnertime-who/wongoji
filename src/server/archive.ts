import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { drizzle } from "drizzle-orm/d1";
import type {
	DocEntry,
	FolderEntry,
	StoreIndex,
	TrashEntry,
} from "#/entities/archive";
import {
	archiveDoc,
	archiveDocContent,
	archiveFolder,
	archiveTombstone,
} from "./schema/archive";

/**
 * 계정 보관함을 D1에서 읽고 쓴다.
 *
 * **브라우저의 `StoreIndex` 모양으로 주고받는다.** 서버 테이블은 소프트 삭제를
 * 쓰고 브라우저는 휴지통 배열을 쓰는데, 그 번역을 여기 한 곳에 모아 둔다. 양쪽에
 * 흩어 놓으면 되살리기가 한쪽에서만 동작하는 종류의 버그가 난다.
 *
 * 타입은 `import type`이라 빌드에서 지워진다 — 화면 코드가 서버로 딸려오지 않는다.
 */

type Db = ReturnType<typeof drizzle>;

/** 브라우저가 모르는 것 하나 — 다른 기기에서 영영 지운 것들 */
export interface ServerArchive extends StoreIndex {
	purged: string[];
}

const asDoc = (row: typeof archiveDoc.$inferSelect): DocEntry => ({
	id: row.id,
	title: row.title,
	path: row.path,
	goal: row.goal,
	chars: row.chars,
	sheets: row.sheets,
	createdAt: row.createdAt.getTime(),
	updatedAt: row.updatedAt.getTime(),
});

const asFolder = (row: typeof archiveFolder.$inferSelect): FolderEntry => ({
	id: row.id,
	name: row.name,
	path: row.path,
});

export async function readArchive(
	db: Db,
	userId: string,
): Promise<ServerArchive> {
	const [folders, docs, purged] = await Promise.all([
		db.select().from(archiveFolder).where(eq(archiveFolder.userId, userId)),
		db.select().from(archiveDoc).where(eq(archiveDoc.userId, userId)),
		db
			.select({ id: archiveTombstone.id })
			.from(archiveTombstone)
			.where(eq(archiveTombstone.userId, userId)),
	]);

	/*
	 * 살아 있는 것과 버린 것을 여기서 가른다. 서버는 행을 그대로 두고 `deletedAt`만
	 * 세우지만, 브라우저는 목록과 휴지통을 다른 배열로 든다.
	 */
	const trash: TrashEntry[] = [
		...docs
			.filter((d) => d.deletedAt !== null)
			.map(
				(d): TrashEntry => ({
					kind: "doc",
					id: d.id,
					title: d.title,
					goal: d.goal,
					path: d.path,
					// biome-ignore lint/style/noNonNullAssertion: 위에서 걸렀다
					deletedAt: d.deletedAt!.getTime(),
				}),
			),
		...folders
			.filter((f) => f.deletedAt !== null)
			.map(
				(f): TrashEntry => ({
					kind: "folder",
					id: f.id,
					name: f.name,
					path: f.path,
					// biome-ignore lint/style/noNonNullAssertion: 위에서 걸렀다
					deletedAt: f.deletedAt!.getTime(),
				}),
			),
	];

	return {
		version: 1,
		folders: folders.filter((f) => f.deletedAt === null).map(asFolder),
		docs: docs.filter((d) => d.deletedAt === null).map(asDoc),
		trash,
		purged: purged.map((p) => p.id),
	};
}

/**
 * 보관함 전체를 계정에 밀어 넣는다.
 *
 * 로컬 원고를 계정으로 올릴 때 쓴다. 있는 것은 고치고 없는 것은 만든다 —
 * **지우지는 않는다.** 이 기기에 없다는 것이 계정에서 지웠다는 뜻은 아니다.
 * 다른 기기에서 쓴 원고가 여기 없을 뿐일 수 있다.
 *
 * D1에는 트랜잭션이 없어 `batch`로 묶는다. 한 번에 보내면 중간에 끊겨도 절반만
 * 들어가는 일이 없다.
 */
export async function pushArchive(
	db: Db,
	userId: string,
	index: StoreIndex,
	now = Date.now(),
): Promise<void> {
	const at = new Date(now);
	const trashedDocs = new Map(
		index.trash.filter((t) => t.kind === "doc").map((t) => [t.id, t]),
	);
	const trashedFolders = new Map(
		index.trash.filter((t) => t.kind === "folder").map((t) => [t.id, t]),
	);

	const rows: BatchItem<"sqlite">[] = [];

	for (const f of index.folders) {
		rows.push(
			db
				.insert(archiveFolder)
				.values({
					userId,
					id: f.id,
					name: f.name,
					path: f.path,
					updatedAt: at,
				})
				.onConflictDoUpdate({
					target: [archiveFolder.userId, archiveFolder.id],
					set: { name: f.name, path: f.path, updatedAt: at, deletedAt: null },
				}),
		);
	}

	for (const d of index.docs) {
		const values = {
			userId,
			id: d.id,
			title: d.title,
			path: d.path,
			goal: d.goal,
			chars: d.chars,
			sheets: d.sheets,
			createdAt: new Date(d.createdAt),
			updatedAt: new Date(d.updatedAt),
		};
		rows.push(
			db
				.insert(archiveDoc)
				.values(values)
				.onConflictDoUpdate({
					target: [archiveDoc.userId, archiveDoc.id],
					set: { ...values, deletedAt: null },
				}),
		);
	}

	for (const [id, t] of trashedFolders) {
		if (t.kind !== "folder") continue;
		rows.push(
			db
				.insert(archiveFolder)
				.values({
					userId,
					id,
					name: t.name,
					path: t.path,
					deletedAt: new Date(t.deletedAt),
				})
				.onConflictDoUpdate({
					target: [archiveFolder.userId, archiveFolder.id],
					set: { deletedAt: new Date(t.deletedAt) },
				}),
		);
	}

	for (const [id, t] of trashedDocs) {
		if (t.kind !== "doc") continue;
		rows.push(
			db
				.insert(archiveDoc)
				.values({
					userId,
					id,
					title: t.title,
					path: t.path,
					goal: t.goal,
					deletedAt: new Date(t.deletedAt),
				})
				.onConflictDoUpdate({
					target: [archiveDoc.userId, archiveDoc.id],
					set: { deletedAt: new Date(t.deletedAt) },
				}),
		);
	}

	/*
	 * `batch`는 적어도 하나를 요구한다. 길이가 하나 이상이라는 것을 타입으로
	 * 알릴 방법이 없어서 여기서만 좁혀 준다 — 바로 위에서 빈 경우를 걸렀다.
	 */
	if (!rows.length) return;
	await db.batch(rows as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/** 계정에 이미 있는 id들. 로컬 원고를 올리기 전에 겹치는지 보려고 쓴다 */
export async function takenIds(db: Db, userId: string): Promise<Set<string>> {
	const [folders, docs, purged] = await Promise.all([
		db
			.select({ id: archiveFolder.id })
			.from(archiveFolder)
			.where(eq(archiveFolder.userId, userId)),
		db
			.select({ id: archiveDoc.id })
			.from(archiveDoc)
			.where(eq(archiveDoc.userId, userId)),
		db
			.select({ id: archiveTombstone.id })
			.from(archiveTombstone)
			.where(eq(archiveTombstone.userId, userId)),
	]);

	/*
	 * 영영 지운 id도 쓰인 것으로 본다. 다시 쓰면 그 자취가 새 원고를 지운다 —
	 * 꺼져 있던 기기가 깨어나 "이건 지워진 것"이라며 치운다.
	 */
	return new Set([...folders, ...docs, ...purged].map((r) => r.id));
}

export async function readDocContent(
	db: Db,
	userId: string,
	docId: string,
): Promise<unknown | null> {
	const [row] = await db
		.select({ content: archiveDocContent.content })
		.from(archiveDocContent)
		.where(
			and(
				eq(archiveDocContent.userId, userId),
				eq(archiveDocContent.docId, docId),
			),
		);

	if (!row) return null;
	try {
		return JSON.parse(row.content);
	} catch {
		return null;
	}
}

export async function writeDocContent(
	db: Db,
	userId: string,
	docId: string,
	content: unknown,
	now = Date.now(),
): Promise<void> {
	const values = {
		userId,
		docId,
		content: JSON.stringify(content),
		updatedAt: new Date(now),
	};

	await db
		.insert(archiveDocContent)
		.values(values)
		.onConflictDoUpdate({
			target: [archiveDocContent.userId, archiveDocContent.docId],
			set: { content: values.content, updatedAt: values.updatedAt },
		});
}

/**
 * 영영 지운다. 자취를 남긴다.
 *
 * 행만 지우면 꺼져 있던 기기가 "없는 것"과 "아직 못 받은 것"을 구별하지 못해
 * 다음 동기화에 그 원고를 되살려 올린다.
 */
export async function purgeEntries(
	db: Db,
	userId: string,
	entries: { id: string; kind: "doc" | "folder" }[],
	now = Date.now(),
): Promise<void> {
	if (!entries.length) return;
	const ids = entries.map((e) => e.id);

	await db.batch([
		db
			.insert(archiveTombstone)
			.values(
				entries.map((e) => ({
					userId,
					id: e.id,
					kind: e.kind,
					purgedAt: new Date(now),
				})),
			)
			.onConflictDoNothing(),
		db
			.delete(archiveDocContent)
			.where(
				and(
					eq(archiveDocContent.userId, userId),
					inArray(archiveDocContent.docId, ids),
				),
			),
		db
			.delete(archiveDoc)
			.where(and(eq(archiveDoc.userId, userId), inArray(archiveDoc.id, ids))),
		db
			.delete(archiveFolder)
			.where(
				and(eq(archiveFolder.userId, userId), inArray(archiveFolder.id, ids)),
			),
	]);
}
