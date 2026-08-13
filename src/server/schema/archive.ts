/**
 * 원고 보관함 — 서버 쪽 테이블.
 *
 * 브라우저의 `StoreIndex`(entities/archive/model/types.ts)를 옮긴 것이다. 뼈대는
 * 그대로 둔다 — **폴더 트리는 부모 id가 아니라 조상 사슬을 경로 문자열로 박아
 * 둔다**(materialized path). 제일 잦은 조회가 "이 폴더 아래 전부"이고, 그것이
 * 접두사 검사 한 번으로 끝나기 때문이다. 서버에서도 같은 이유가 그대로 산다.
 *
 * 나누는 기준도 그대로다. 목록을 그릴 때 본문을 읽지 않아야 해서 제목·분량은
 * 원고 행에 두고 본문은 다른 테이블에 둔다. 로컬에서 색인과 본문 키를 나눈 것과
 * 같은 이유다.
 */

import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/** 로컬과 같은 뜻. `"/"`는 보이지 않는 root, 자기 id는 들어가지 않는다 */
const path = () => text("path").notNull();

/**
 * 형제 사이에서 몇 번째인가. 로컬 `order`가 그대로 온다.
 *
 * **컬럼 이름은 `sort_order`다** — `order`는 SQL 예약어라 쓰는 자리마다 따옴표를
 * 둘러야 하고, 한 번 빠뜨리면 문법 오류가 난다. TS 쪽 이름은 로컬과 맞춘다.
 *
 * 정렬은 브라우저가 한다. 한 사람의 행 수가 작아서 인덱스를 따로 두지 않는다.
 */
const sortOrder = () => integer("sort_order").default(0).notNull();

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/*
 * 열쇠는 (user_id, id) 두 벌이다.
 *
 * id는 cuid2(열여섯 자)라 기기가 여럿이어도 겹치지 않지만, 그것을 전역 열쇠로
 * 삼을 이유는 없다. 사용자 안으로 가두면 남의 행을 건드릴 길이 구조적으로
 * 막힌다 — 질의에 `user_id`를 빠뜨리는 실수가 곧 남의 원고를 여는 실수가 되지
 * 않는다.
 *
 * 로그인 없던 시절의 여덟 자짜리 id도 이 표에 올라온다. 옮길 때 겹치는 것만
 * 다시 매긴다.
 */
const owner = () =>
	text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" });

/**
 * 사이드바의 그룹.
 *
 * `path`에는 조상 폴더 id들이 들어간다. 그 id들을 외래 키로 걸 수는 없다 —
 * 문자열 안에 박혀 있는 것이 mpath의 정의다. 사슬이 끊긴 경우는 로컬과 똑같이
 * `settleUnder`가 다듬는다.
 */
export const archiveFolder = sqliteTable(
	"archive_folder",
	{
		userId: owner(),
		id: text("id").notNull(),
		name: text("name").notNull(),
		path: path(),
		order: sortOrder(),

		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		/** 휴지통에 있으면 버린 시각. 살아 있으면 null */
		deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.id] }),
		// "이 폴더 아래 전부" — mpath를 쓰는 이유가 이 인덱스다
		index("archive_folder_path_idx").on(t.userId, t.path),
	],
);

/**
 * 원고. 본문은 여기 없다.
 *
 * `chars`·`sheets`는 본문을 읽어야 나오는 값이지만 목록에 보여주려고 여기 함께
 * 둔다. 로컬에서 `DocEntry`가 그것을 들고 있는 것과 같고, 치르는 값도 같다 —
 * 본문이 바뀌면 이 둘도 함께 고쳐야 한다.
 */
export const archiveDoc = sqliteTable(
	"archive_doc",
	{
		userId: owner(),
		id: text("id").notNull(),
		title: text("title").notNull(),
		path: path(),
		order: sortOrder(),
		/** 목표 매수. 0이면 목표를 두지 않은 것 */
		goal: integer("goal").default(0).notNull(),
		chars: integer("chars").default(0).notNull(),
		sheets: integer("sheets").default(0).notNull(),

		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.id] }),
		index("archive_doc_path_idx").on(t.userId, t.path),
		// 사이드바와 홈이 "최근 고친 순"으로 읽는다
		index("archive_doc_updated_idx").on(t.userId, t.updatedAt),
	],
);

/**
 * 본문. Tiptap 문서를 그대로 담는다.
 *
 * 표를 나눈 이유는 로컬에서 키를 나눈 이유와 같다. 목록은 원고 수만큼 행을
 * 읽는데 거기에 본문이 섞이면 목록 한 번에 원고 전체가 딸려 온다.
 *
 * `updatedAt`이 원고 행에도 있고 여기에도 있다. 제목만 고쳤는지 본문을 고쳤는지
 * 갈라 보아야 밀어 넣을 것만 밀어 넣는다.
 */
export const archiveDocContent = sqliteTable(
	"archive_doc_content",
	{
		userId: owner(),
		docId: text("doc_id").notNull(),
		content: text("content").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.docId] })],
);

/**
 * 영영 지운 것의 자취.
 *
 * 휴지통을 비우면 행이 사라지는데, 그때 꺼져 있던 기기는 그 사실을 알 길이
 * 없다. 없는 것과 "아직 못 받은 것"을 구별하지 못하면 다음 동기화에 그 원고를
 * 되살려 올린다. 지웠다는 사실 자체를 남겨 두어야 지운 것이 지워진 채로 있다.
 *
 * 로컬에는 대응하는 것이 없다 — 탭이 여럿이어도 같은 저장소를 보므로 필요가
 * 없었다. 기기가 여럿이 되면서 생긴 것이다.
 */
export const archiveTombstone = sqliteTable(
	"archive_tombstone",
	{
		userId: owner(),
		id: text("id").notNull(),
		/** `doc` | `folder` */
		kind: text("kind").notNull(),
		purgedAt: integer("purged_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.id] }),
		index("archive_tombstone_purged_idx").on(t.userId, t.purgedAt),
	],
);

export const archiveDocRelations = relations(archiveDoc, ({ one }) => ({
	content: one(archiveDocContent, {
		fields: [archiveDoc.userId, archiveDoc.id],
		references: [archiveDocContent.userId, archiveDocContent.docId],
	}),
}));
