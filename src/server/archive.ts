import { and, eq, inArray, lt } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { drizzle } from "drizzle-orm/d1";
import type {
	DocEntry,
	FolderEntry,
	StoreIndex,
	TrashEntry,
} from "#/entities/archive";
/*
 * 색인을 고치는 순수 함수를 그대로 부른다. **배럴(`#/entities/archive`)이 아니라
 * 모듈을 곧장 부른다** — 배럴에는 화면 부품과 localStorage를 만지는 것이 함께
 * 실려 있어서, 그것을 부르면 서버 번들이 그것들을 끌고 온다.
 *
 * 이 길은 biome이 열어 둔 것이다: "순수한 도메인 로직이 필요하면 entities나
 * shared에서 가져와라 — 그러라고 operations.ts를 저장소로부터 떼어 놓았다."
 */
import { TRASH_DAYS } from "#/entities/archive/config/limits";
import { makeId } from "#/entities/archive/model/operations";
import { type ArchiveOp, applyOp } from "#/entities/archive/model/ops";
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
 * **정본은 여기다.** 브라우저는 이것을 받아 그릴 뿐 제 사본을 정본으로 두지
 * 않는다. 전에는 양쪽이 각자 쓸 수 있는 사본을 들고 있었고, 화해할 규칙이 없어서
 * 완전히 지운 원고가 새로고침하면 되살아났다.
 */

type Db = ReturnType<typeof drizzle>;

const DAY = 24 * 60 * 60 * 1000;

const asDoc = (row: typeof archiveDoc.$inferSelect): DocEntry => ({
	id: row.id,
	title: row.title,
	path: row.path,
	order: row.order,
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
	order: row.order,
});

/**
 * 계정 보관함 전체.
 *
 * **영영 지운 것(자취가 남은 것)은 돌려주지 않는다.** 다른 기기가 아직 그것을
 * 휴지통에 들고 있다가 밀어 넣으면 행이 되살아나는데, 여기서 걸러 두면 그 행은
 * 아무에게도 보이지 않고 다음 정리에 사라진다.
 */
export async function readArchive(db: Db, userId: string): Promise<StoreIndex> {
	const [folders, docs, purged] = await Promise.all([
		db.select().from(archiveFolder).where(eq(archiveFolder.userId, userId)),
		db.select().from(archiveDoc).where(eq(archiveDoc.userId, userId)),
		db
			.select({ id: archiveTombstone.id })
			.from(archiveTombstone)
			.where(eq(archiveTombstone.userId, userId)),
	]);

	const gone = new Set(purged.map((p) => p.id));
	const liveFolders = folders.filter((f) => !gone.has(f.id));
	const liveDocs = docs.filter((d) => !gone.has(d.id));

	/*
	 * 살아 있는 것과 버린 것을 여기서 가른다. 서버는 행을 그대로 두고 `deletedAt`만
	 * 세우지만, 브라우저는 목록과 휴지통을 다른 배열로 든다.
	 */
	const trash: TrashEntry[] = [
		...liveDocs
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
		...liveFolders
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
		/*
		 * 판 번호를 상수로 부르지 않고 그대로 적는다. 값을 import하면 화면 쪽
		 * 모듈이 서버 번들에 실리는데, 이 파일이 색인 순수 함수만 골라 부르는
		 * 이유가 그것을 막으려는 것이다.
		 *
		 * 어긋날 걱정은 없다 — `StoreIndex.version`이 `typeof INDEX_VERSION`이라
		 * 리터럴 타입이다. 판이 올라가면 여기가 컴파일되지 않는다.
		 */
		version: 2,
		folders: liveFolders.filter((f) => f.deletedAt === null).map(asFolder),
		docs: liveDocs.filter((d) => d.deletedAt === null).map(asDoc),
		trash,
	};
}

/**
 * 기한이 지난 휴지통을 비운다. 보관함을 읽기 전에 한 번 부른다.
 *
 * **브라우저가 하던 일을 가져왔다.** 전에는 앱을 열 때 로컬에서 비웠는데, 그
 * 사실이 서버로 갈 길이 없어서 다음에 받아 올 때 그대로 되살아났다 — 만료된
 * 항목이 "0일 남음"인 채로 영영 남아 열 때마다 지웠다 살아나기를 되풀이했다.
 *
 * 따로 도는 일감(cron)을 두지 않는다. 아무도 열지 않는 보관함의 휴지통은
 * 비워질 이유가 없다.
 */
export async function sweepExpired(
	db: Db,
	userId: string,
	now = Date.now(),
): Promise<void> {
	const cutoff = new Date(now - TRASH_DAYS * DAY);

	const [docs, folders] = await Promise.all([
		db
			.select({ id: archiveDoc.id })
			.from(archiveDoc)
			.where(
				and(eq(archiveDoc.userId, userId), lt(archiveDoc.deletedAt, cutoff)),
			),
		db
			.select({ id: archiveFolder.id })
			.from(archiveFolder)
			.where(
				and(
					eq(archiveFolder.userId, userId),
					lt(archiveFolder.deletedAt, cutoff),
				),
			),
	]);

	await purgeEntries(
		db,
		userId,
		[
			...docs.map((d) => ({ id: d.id, kind: "doc" as const })),
			...folders.map((f) => ({ id: f.id, kind: "folder" as const })),
		],
		now,
	);
}

/**
 * 연산 하나를 적용하고 바뀐 뒤의 보관함을 돌려준다.
 *
 * 읽고 → `applyOp` → 바뀐 행만 쓴다. **색인을 통째로 받아 덮어쓰지 않는 이유**는
 * 그렇게 하면 나중에 보낸 쪽이 이기고, 무엇보다 빠진 것을 지운 것으로 볼 수가
 * 없기 때문이다.
 *
 * D1에는 트랜잭션이 없다. 읽고-고치고-쓰는 사이에 같은 사람의 다른 요청이 끼면
 * 하나가 묻힌다 — 한 사람이 탭 둘을 동시에 두드릴 때만 생기는 일이라 지금은
 * 감수한다. 필요해지면 색인에 판 번호를 두고 낙관적 잠금을 건다.
 */
export async function applyArchiveOp(
	db: Db,
	userId: string,
	op: ArchiveOp,
	now = Date.now(),
): Promise<{ index: StoreIndex; createdDocId?: string }> {
	const before = await readArchive(db, userId);
	const effect = applyOp(before, op, {
		now,
		newId: MAKES_ID.has(op.kind) ? await minter(db, userId, before) : undefined,
	});

	await persist(db, userId, before, effect.index, now);

	/*
	 * 복제는 본문까지 뜬다. 브라우저를 시키지 않는 이유는 그쪽이 본문을 들고
	 * 있다는 보장이 없어서다 — 열어 본 적 없는 원고를 목록에서 바로 복제할 수 있다.
	 */
	if (effect.copiedFrom && effect.createdDocId) {
		await copyDocContent(
			db,
			userId,
			effect.copiedFrom,
			effect.createdDocId,
			now,
		);
	}

	/*
	 * 만든 id는 **서버가 정한다.** 브라우저가 미리 지어 두면 다른 기기가 쓰던
	 * id와 부딪히는데, 그것을 피하려고 id를 다시 매기는 일이 지금 로그인할 때
	 * 한 번 도는 코드로 남아 있다. 만드는 자리를 한 곳으로 모으면 그 일이 없다.
	 */
	return { index: effect.index, createdDocId: effect.createdDocId };
}

/** id를 만드는 연산들. 이때만 자취까지 물어본다 */
const MAKES_ID = new Set<ArchiveOp["kind"]>([
	"createDoc",
	"createFolder",
	"duplicateDoc",
]);

/**
 * 겹치지 않는 id를 만든다.
 *
 * id는 여덟 자 난수라 부딪힐 일이 사실상 없지만, **부딪혔을 때 조용하고 영영
 * 잃는다**는 것이 문제다. 두 가지로 잃는다.
 *
 * - 살아 있는 id와 겹치면 그 행을 덮어쓴다 — 멀쩡한 원고가 새 원고가 된다
 * - **자취(tombstone)에 있는 id와 겹치면 더 나쁘다.** `readArchive`가 자취를
 *   걸러 내므로 그 원고는 만들어진 순간부터 아무에게도 보이지 않는다. 화면에는
 *   응답에 실려 온 것이 잠깐 보이고, 새로고침하면 사라진다
 *
 * 만드는 자리가 서버 하나뿐이라 그때 이미 색인을 손에 들고 있다. 물어보는 값이
 * 자취 한 번 읽는 것뿐이라 안 할 이유가 없다.
 */
async function minter(
	db: Db,
	userId: string,
	index: StoreIndex,
): Promise<() => string> {
	const purged = await db
		.select({ id: archiveTombstone.id })
		.from(archiveTombstone)
		.where(eq(archiveTombstone.userId, userId));

	const used = new Set<string>([
		...index.folders.map((f) => f.id),
		...index.docs.map((d) => d.id),
		...index.trash.map((t) => t.id),
		...purged.map((p) => p.id),
	]);

	return () => {
		let id = makeId();
		while (used.has(id)) id = makeId();
		// 한 연산이 둘을 만들 수 있다(복제). 방금 준 것도 쓰인 것으로 친다
		used.add(id);
		return id;
	};
}

/**
 * 바뀐 것만 쓴다.
 *
 * 손대지 않은 항목은 `operations.ts`가 **같은 객체를 그대로 돌려준다** — 그리는
 * 쪽이 다시 그릴 이유를 만들지 않으려고 지켜 온 성질인데, 여기서 한 번 더 값을
 * 한다. 참조만 견주면 무엇이 바뀌었는지 알 수 있어 제목 한 글자에 원고 200줄을
 * 다시 쓰지 않는다.
 *
 * 참조가 다른데 내용이 같을 수는 있다(쓸데없는 upsert 한 번). 그 반대는 없다 —
 * 내용이 바뀌었는데 같은 객체인 경우가 없으므로 빠뜨리지 않는다.
 */
async function persist(
	db: Db,
	userId: string,
	before: StoreIndex,
	after: StoreIndex,
	now: number,
): Promise<void> {
	const at = new Date(now);
	const rows: BatchItem<"sqlite">[] = [];

	const wasFolder = new Map(before.folders.map((f) => [f.id, f]));
	const wasDoc = new Map(before.docs.map((d) => [d.id, d]));
	const wasTrashed = new Set(before.trash.map((t) => t.id));

	for (const f of after.folders) {
		if (wasFolder.get(f.id) === f) continue;
		rows.push(
			db
				.insert(archiveFolder)
				.values({
					userId,
					id: f.id,
					name: f.name,
					path: f.path,
					order: f.order,
					updatedAt: at,
				})
				.onConflictDoUpdate({
					target: [archiveFolder.userId, archiveFolder.id],
					set: {
						name: f.name,
						path: f.path,
						order: f.order,
						updatedAt: at,
						// 되살린 것이 여기로 온다. 버렸던 표시를 지운다
						deletedAt: null,
					},
				}),
		);
	}

	for (const d of after.docs) {
		if (wasDoc.get(d.id) === d) continue;
		const values = {
			userId,
			id: d.id,
			title: d.title,
			path: d.path,
			order: d.order,
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
					/*
					 * `createdAt`은 고치지 않는다. 되살린 원고는 색인에서 만든 시각이
					 * 지금으로 적히는데, 행이 아는 처음 만든 시각이 사실이다.
					 */
					set: {
						title: values.title,
						path: values.path,
						order: values.order,
						goal: values.goal,
						chars: values.chars,
						sheets: values.sheets,
						updatedAt: values.updatedAt,
						deletedAt: null,
					},
				}),
		);
	}

	// 새로 버려진 것. 행은 이미 있으므로 버린 시각만 세운다
	for (const t of after.trash) {
		if (wasTrashed.has(t.id)) continue;
		const deletedAt = new Date(t.deletedAt);

		if (t.kind === "folder") {
			rows.push(
				db
					.insert(archiveFolder)
					.values({ userId, id: t.id, name: t.name, path: t.path, deletedAt })
					.onConflictDoUpdate({
						target: [archiveFolder.userId, archiveFolder.id],
						set: { deletedAt },
					}),
			);
		} else {
			rows.push(
				db
					.insert(archiveDoc)
					.values({
						userId,
						id: t.id,
						title: t.title,
						path: t.path,
						goal: t.goal,
						deletedAt,
					})
					.onConflictDoUpdate({
						target: [archiveDoc.userId, archiveDoc.id],
						set: { deletedAt },
					}),
			);
		}
	}

	if (rows.length) {
		await db.batch(rows as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
	}

	/*
	 * 색인에서 통째로 빠진 것은 영영 지운 것이다.
	 *
	 * 어느 연산이 지웠는지 묻지 않고 **앞뒤를 견주어 알아낸다.** 지우는 연산이
	 * 늘어나도 여기가 따라 늘 필요가 없고, 무엇보다 빠뜨릴 수가 없다.
	 */
	const alive = new Set([
		...after.folders.map((f) => f.id),
		...after.docs.map((d) => d.id),
		...after.trash.map((t) => t.id),
	]);
	const gone = [
		...before.folders.map((f) => ({ id: f.id, kind: "folder" as const })),
		...before.docs.map((d) => ({ id: d.id, kind: "doc" as const })),
		...before.trash.map((t) => ({ id: t.id, kind: t.kind })),
	].filter((e) => !alive.has(e.id));

	await purgeEntries(db, userId, gone, now);
}

/** 본문을 새 id로 베낀다. 복제가 쓴다 */
async function copyDocContent(
	db: Db,
	userId: string,
	from: string,
	to: string,
	now: number,
): Promise<void> {
	const [row] = await db
		.select({ content: archiveDocContent.content })
		.from(archiveDocContent)
		.where(
			and(
				eq(archiveDocContent.userId, userId),
				eq(archiveDocContent.docId, from),
			),
		);
	// 원본에 본문이 없으면 사본에도 없다. 빈 것을 지어내면 잃은 것을 덮는다
	if (!row) return;

	const values = {
		userId,
		docId: to,
		content: row.content,
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
 * 보관함 전체를 계정에 밀어 넣는다.
 *
 * **한 번만 쓰는 길이다** — 로그인하기 전에 이 브라우저에 쓴 원고를 계정으로
 * 옮길 때. 평소의 고치기는 `applyArchiveOp`로 간다.
 *
 * 있는 것은 고치고 없는 것은 만든다. 지우지는 않는다 — 이 기기에 없다는 것이
 * 계정에서 지웠다는 뜻은 아니다.
 *
 * **자취가 남은 id는 건너뛴다.** 영영 지운 원고를 들고 있던 기기가 그것을
 * 되살려 올리는 것이 지금 고치고 있는 바로 그 버그다.
 */
export async function pushArchive(
	db: Db,
	userId: string,
	index: StoreIndex,
	now = Date.now(),
): Promise<void> {
	const at = new Date(now);
	const dead = new Set(
		(
			await db
				.select({ id: archiveTombstone.id })
				.from(archiveTombstone)
				.where(eq(archiveTombstone.userId, userId))
		).map((p) => p.id),
	);

	const rows: BatchItem<"sqlite">[] = [];

	for (const f of index.folders) {
		if (dead.has(f.id)) continue;
		rows.push(
			db
				.insert(archiveFolder)
				.values({
					userId,
					id: f.id,
					name: f.name,
					path: f.path,
					order: f.order,
					updatedAt: at,
				})
				.onConflictDoUpdate({
					target: [archiveFolder.userId, archiveFolder.id],
					set: {
						name: f.name,
						path: f.path,
						order: f.order,
						updatedAt: at,
						deletedAt: null,
					},
				}),
		);
	}

	for (const d of index.docs) {
		if (dead.has(d.id)) continue;
		const values = {
			userId,
			id: d.id,
			title: d.title,
			path: d.path,
			order: d.order,
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

	for (const t of index.trash) {
		if (dead.has(t.id)) continue;
		const deletedAt = new Date(t.deletedAt);

		if (t.kind === "folder") {
			rows.push(
				db
					.insert(archiveFolder)
					.values({ userId, id: t.id, name: t.name, path: t.path, deletedAt })
					.onConflictDoUpdate({
						target: [archiveFolder.userId, archiveFolder.id],
						set: { deletedAt },
					}),
			);
		} else {
			rows.push(
				db
					.insert(archiveDoc)
					.values({
						userId,
						id: t.id,
						title: t.title,
						path: t.path,
						goal: t.goal,
						deletedAt,
					})
					.onConflictDoUpdate({
						target: [archiveDoc.userId, archiveDoc.id],
						set: { deletedAt },
					}),
			);
		}
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
