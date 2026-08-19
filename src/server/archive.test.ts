import { describe, expect, it } from "vitest";
import {
	applyArchiveOp,
	demoteOnEdit,
	listVersions,
	readArchive,
	readDocContent,
	restoreVersion,
	sweepExpired,
	takenIds,
	writeDocContent,
} from "./archive";
import { db, 글, 사람 } from "./testing/harness";

/**
 * 계정 보관함을 D1에서 읽고 쓴다.
 *
 * **진짜 D1이다.** workerd 안에서 `drizzle/`의 마이그레이션을 그대로 올린 것을
 * 쓴다(`vitest.config.ts`의 `d1` 프로젝트). SQLite를 흉내 낸 것이 아니라,
 * 외래 키도 `db.batch()`의 원자성도 배포본과 같게 동작한다.
 *
 * 여기서 볼 것은 색인 규칙이 아니다 — 그쪽은 `operations.test.ts`가 순수 함수로
 * 이미 본다. 여기 있는 것은 **그 순수 함수와 테이블 사이의 번역**이고, 그것이
 * 이 파일에만 있다.
 *
 * - 소프트 삭제(`deletedAt`) ↔ 휴지통 배열
 * - 계정 칸 가르기 — 남의 원고가 보이거나 고쳐지면 안 된다
 * - 자취(tombstone) — 영영 지운 것이 되살아나지 않게
 * - 버전 박제와 되돌리기
 *
 * 라우트를 지나는 쪽은 `routes/api.archive.*.test.ts`에 있다.
 */

/** 원고 하나를 만들고 본문까지 넣는다 */
async function 원고(
	userId: string,
	{ title = "", body = "본문" }: { title?: string; body?: string } = {},
): Promise<string> {
	const { createdDocId } = await applyArchiveOp(db, userId, {
		kind: "createDoc",
		path: "/",
		title,
	});
	if (!createdDocId) throw new Error("원고를 만들지 못했다");
	await writeDocContent(db, userId, createdDocId, 글(body));
	return createdDocId;
}

const 상태를 = (userId: string, id: string, status: "revising" | "done") =>
	applyArchiveOp(db, userId, { kind: "updateDoc", id, patch: { status } });

describe("계정 칸", () => {
	it("남의 보관함이 보이지 않는다", async () => {
		const u1 = await 사람("칸-1");
		const u2 = await 사람("칸-2");
		await 원고(u1, { title: "내 원고" });

		expect((await readArchive(db, u1)).docs).toHaveLength(1);
		expect((await readArchive(db, u2)).docs).toEqual([]);
	});

	it("남의 원고 id로 버려도 그쪽은 멀쩡하다", async () => {
		const u1 = await 사람("칸-버리기-1");
		const u2 = await 사람("칸-버리기-2");
		const docId = await 원고(u1, { title: "건드리지 마라" });

		await applyArchiveOp(db, u2, { kind: "trashDoc", id: docId });

		const 그쪽 = await readArchive(db, u1);
		expect(그쪽.docs).toHaveLength(1);
		expect(그쪽.trash).toEqual([]);
	});

	it("남의 본문을 읽지 못한다", async () => {
		const u1 = await 사람("칸-본문-1");
		const u2 = await 사람("칸-본문-2");
		const docId = await 원고(u1, { body: "내 글" });

		expect(await readDocContent(db, u1, docId)).toEqual(글("내 글"));
		expect(await readDocContent(db, u2, docId)).toBeNull();
	});

	it("남의 원고는 강등시키지 못한다", async () => {
		const u1 = await 사람("칸-강등-1");
		const u2 = await 사람("칸-강등-2");
		const docId = await 원고(u1);
		await 상태를(u1, docId, "done");

		expect(await demoteOnEdit(db, u2, docId)).toBeNull();
		const 그쪽 = await readArchive(db, u1);
		expect(그쪽.docs[0]?.status).toBe("done");
	});
});

describe("소프트 삭제 ↔ 휴지통", () => {
	it("버리면 목록에서 빠져 휴지통으로 간다", async () => {
		// 서버는 행을 그대로 두고 `deletedAt`만 세운다. 브라우저는 배열 둘로 든다
		const u = await 사람("휴지통-기본");
		const docId = await 원고(u, { title: "버릴 원고" });

		const 뒤 = (await applyArchiveOp(db, u, { kind: "trashDoc", id: docId }))
			.index;
		expect(뒤.docs).toEqual([]);
		expect(뒤.trash).toMatchObject([
			{ kind: "doc", id: docId, title: "버릴 원고" },
		]);
	});

	it("되살리면 상태까지 그대로 돌아온다", async () => {
		// 안 들고 가면 완성본이 초고로 돌아온다
		const u = await 사람("휴지통-되살리기");
		const docId = await 원고(u);
		await 상태를(u, docId, "done");

		await applyArchiveOp(db, u, { kind: "trashDoc", id: docId });
		const 뒤 = (await applyArchiveOp(db, u, { kind: "restore", id: docId }))
			.index;

		expect(뒤.trash).toEqual([]);
		expect(뒤.docs[0]).toMatchObject({ id: docId, status: "done" });
	});

	it("버린 원고의 본문은 그대로 있다 — 되살릴 것이니까", async () => {
		const u = await 사람("휴지통-본문");
		const docId = await 원고(u, { body: "살아 있어야 한다" });

		await applyArchiveOp(db, u, { kind: "trashDoc", id: docId });

		expect(await readDocContent(db, u, docId)).toEqual(글("살아 있어야 한다"));
	});

	it("폴더를 버리면 그 안의 원고도 함께 간다", async () => {
		const u = await 사람("휴지통-폴더");
		const { index: 만든뒤 } = await applyArchiveOp(db, u, {
			kind: "createFolder",
			name: "소설",
			path: "/",
		});
		const folderId = 만든뒤.folders[0]?.id ?? "";
		const { createdDocId } = await applyArchiveOp(db, u, {
			kind: "createDoc",
			path: `/${folderId}/`,
		});

		const 뒤 = (
			await applyArchiveOp(db, u, { kind: "trashFolder", id: folderId })
		).index;

		expect(뒤.docs).toEqual([]);
		expect(뒤.trash.map((t) => t.id).sort()).toEqual(
			[folderId, createdDocId].sort(),
		);
	});
});

describe("자취", () => {
	it("영영 지우면 보관함에서 사라진다", async () => {
		const u = await 사람("자취-기본");
		const docId = await 원고(u);
		await applyArchiveOp(db, u, { kind: "trashDoc", id: docId });

		const 뒤 = (await applyArchiveOp(db, u, { kind: "purge", ids: [docId] }))
			.index;
		expect(뒤.docs).toEqual([]);
		expect(뒤.trash).toEqual([]);
	});

	it("지운 id는 여전히 쓰인 것으로 친다", async () => {
		/*
		 * **다시 쓰면 그 자취가 새 원고를 지운다** — 꺼져 있던 기기가 깨어나
		 * "이건 지워진 것"이라며 치운다.
		 */
		const u = await 사람("자취-id");
		const docId = await 원고(u);
		await applyArchiveOp(db, u, { kind: "trashDoc", id: docId });
		await applyArchiveOp(db, u, { kind: "purge", ids: [docId] });

		expect(await takenIds(db, u)).toContain(docId);
	});

	it("본문과 이력도 함께 지운다", async () => {
		const u = await 사람("자취-딸림");
		const docId = await 원고(u);
		await 상태를(u, docId, "revising");
		expect(await listVersions(db, u, docId)).toHaveLength(1);

		await applyArchiveOp(db, u, { kind: "trashDoc", id: docId });
		await applyArchiveOp(db, u, { kind: "purge", ids: [docId] });

		expect(await readDocContent(db, u, docId)).toBeNull();
		expect(await listVersions(db, u, docId)).toEqual([]);
	});
});

describe("본문", () => {
	it("넣은 것을 그대로 돌려준다", async () => {
		const u = await 사람("본문-왕복");
		const docId = await 원고(u, { body: "감나무 있는 마당" });
		expect(await readDocContent(db, u, docId)).toEqual(글("감나무 있는 마당"));
	});

	it("없는 원고의 본문은 없다", async () => {
		const u = await 사람("본문-없음");
		expect(await readDocContent(db, u, "한번도없던것")).toBeNull();
	});

	it("달라진 것이 없으면 쓰지 않는다", async () => {
		/*
		 * **여기가 완성본이 열기만 해도 풀리던 자리다.** 에디터는 원고를 앉힐 때마다
		 * 한 번 알리고 그것이 저장 큐를 타는데, 그 쓰기가 강등을 부른다.
		 */
		const u = await 사람("본문-같으면");
		const docId = await 원고(u, { body: "같은 글" });

		expect(await writeDocContent(db, u, docId, 글("같은 글"))).toEqual({
			changed: false,
			delta: 0,
		});
		// 늘어난 글자 수도 함께 낸다. 잔디가 그 값으로 심긴다
		expect(await writeDocContent(db, u, docId, 글("고친 글"))).toEqual({
			changed: true,
			delta: 0,
		});
	});
});

describe("완성본 강등", () => {
	it("완성본을 고치면 퇴고로 내린다", async () => {
		const u = await 사람("강등-완성");
		const docId = await 원고(u);
		await 상태를(u, docId, "done");

		expect(await demoteOnEdit(db, u, docId)).toBe("revising");
		expect((await readArchive(db, u)).docs[0]?.status).toBe("revising");
	});

	it("완성본이 아니면 아무 일도 없다", async () => {
		// 초고를 고쳤다고 뭔가 바뀌면 놀란다
		const u = await 사람("강등-초고");
		const docId = await 원고(u);
		expect(await demoteOnEdit(db, u, docId)).toBeNull();

		await 상태를(u, docId, "revising");
		expect(await demoteOnEdit(db, u, docId)).toBeNull();
	});

	it("없는 원고는 아무 일도 없다", async () => {
		const u = await 사람("강등-없음");
		expect(await demoteOnEdit(db, u, "한번도없던것")).toBeNull();
	});
});

describe("버전 박제", () => {
	it("상태를 올리면 그때의 원고를 남긴다", async () => {
		const u = await 사람("버전-올림");
		const docId = await 원고(u, { title: "제목", body: "박제될 글" });

		await 상태를(u, docId, "revising");

		const 이력 = await listVersions(db, u, docId);
		expect(이력).toHaveLength(1);
		expect(이력[0]).toMatchObject({
			kind: "status",
			status: "revising",
			title: "제목",
			excerpt: "박제될 글",
		});
	});

	it("내리는 전이에는 남기지 않는다", async () => {
		/*
		 * 자동 강등이 대부분이고, 그때 남길 본문은 이미 직전 버전으로 있다.
		 * 이 규칙 하나가 버전 수에 자연스러운 상한을 만든다.
		 */
		const u = await 사람("버전-내림");
		const docId = await 원고(u);
		await 상태를(u, docId, "done");
		const 올린뒤 = (await listVersions(db, u, docId)).length;

		await 상태를(u, docId, "revising");

		expect(await listVersions(db, u, docId)).toHaveLength(올린뒤);
	});

	it("새로 만든 원고는 남기지 않는다", async () => {
		// 거르지 않으면 새 원고마다 빈 본문이 이력에 한 줄씩 쌓인다
		const u = await 사람("버전-새원고");
		const docId = await 원고(u);
		expect(await listVersions(db, u, docId)).toEqual([]);
	});

	it("휴지통에서 되살린 것도 남기지 않는다", async () => {
		const u = await 사람("버전-되살림");
		const docId = await 원고(u);
		await 상태를(u, docId, "done");
		const 버린뒤 = (await listVersions(db, u, docId)).length;

		await applyArchiveOp(db, u, { kind: "trashDoc", id: docId });
		await applyArchiveOp(db, u, { kind: "restore", id: docId });

		expect(await listVersions(db, u, docId)).toHaveLength(버린뒤);
	});

	it("본문이 없으면 남기지 않는다 — 되돌릴 것이 없는 버전이다", async () => {
		const u = await 사람("버전-빈본문");
		const { createdDocId = "" } = await applyArchiveOp(db, u, {
			kind: "createDoc",
			path: "/",
		});

		await 상태를(u, createdDocId, "done");

		expect(await listVersions(db, u, createdDocId)).toEqual([]);
	});

	it("목록에는 본문을 싣지 않는다 — 원고 수만큼 무거워진다", async () => {
		const u = await 사람("버전-발췌");
		const docId = await 원고(u, { body: "가".repeat(200) });
		await 상태를(u, docId, "revising");

		const [줄] = await listVersions(db, u, docId);
		expect(줄).not.toHaveProperty("content");
		// 발췌는 80자에서 자른다
		expect(줄?.excerpt).toHaveLength(80);
	});
});

describe("되돌리기", () => {
	it("본문과 제목과 상태를 그때로 되돌린다", async () => {
		const u = await 사람("되돌리기-기본");
		const docId = await 원고(u, { title: "그때 제목", body: "그때 글" });
		await 상태를(u, docId, "done");

		const [박제] = await listVersions(db, u, docId);
		await applyArchiveOp(db, u, {
			kind: "updateDoc",
			id: docId,
			patch: { title: "지금 제목" },
		});
		await writeDocContent(db, u, docId, 글("지금 글"));

		const 뒤 = await restoreVersion(db, u, docId, 박제?.id ?? "");

		expect(await readDocContent(db, u, docId)).toEqual(글("그때 글"));
		expect(뒤?.docs[0]).toMatchObject({ title: "그때 제목", status: "done" });
	});

	it("되돌리기 전에 지금 것을 먼저 남긴다", async () => {
		// **되돌리기 자체를 되돌릴 수 있어야 한다** — 첫째는 잃지 않는 것이다
		const u = await 사람("되돌리기-backup");
		const docId = await 원고(u, { body: "그때 글" });
		await 상태를(u, docId, "revising");
		const [박제] = await listVersions(db, u, docId);

		await writeDocContent(db, u, docId, 글("지금 글"));
		await restoreVersion(db, u, docId, 박제?.id ?? "");

		const 이력 = await listVersions(db, u, docId);
		const backup = 이력.find((v) => v.kind === "backup");
		expect(backup).toBeTruthy();
		expect(backup?.excerpt).toBe("지금 글");
	});

	it("자리는 건드리지 않는다", async () => {
		// 버전이 담지 않는 값이다. 되돌렸다고 폴더가 옮겨지면 놀란다
		const u = await 사람("되돌리기-자리");
		const { index } = await applyArchiveOp(db, u, {
			kind: "createFolder",
			name: "소설",
			path: "/",
		});
		const folderId = index.folders[0]?.id ?? "";
		const { createdDocId = "" } = await applyArchiveOp(db, u, {
			kind: "createDoc",
			path: `/${folderId}/`,
		});
		await writeDocContent(db, u, createdDocId, 글("글"));
		await 상태를(u, createdDocId, "revising");
		const [박제] = await listVersions(db, u, createdDocId);

		const 뒤 = await restoreVersion(db, u, createdDocId, 박제?.id ?? "");

		expect(뒤?.docs[0]?.path).toBe(`/${folderId}/`);
	});

	it("남의 원고의 버전은 없는 것으로 본다", async () => {
		const u1 = await 사람("되돌리기-남-1");
		const u2 = await 사람("되돌리기-남-2");
		const docId = await 원고(u1);
		await 상태를(u1, docId, "revising");
		const [박제] = await listVersions(db, u1, docId);

		expect(await restoreVersion(db, u2, docId, 박제?.id ?? "")).toBeNull();
	});

	it("다른 원고의 버전을 갖다 붙이지 못한다", async () => {
		const u = await 사람("되돌리기-다른원고");
		const a = await 원고(u, { body: "가" });
		const b = await 원고(u, { body: "나" });
		await 상태를(u, a, "revising");
		const [박제] = await listVersions(db, u, a);

		expect(await restoreVersion(db, u, b, 박제?.id ?? "")).toBeNull();
	});
});

describe("기한 지난 휴지통 비우기", () => {
	const DAY = 24 * 60 * 60 * 1000;

	it("30일이 지난 것만 비운다", async () => {
		const u = await 사람("만료-경계");
		const 오래된 = await 원고(u, { title: "31일 전" });
		const 최근 = await 원고(u, { title: "어제" });

		const 지금 = Date.now();
		await applyArchiveOp(
			db,
			u,
			{ kind: "trashDoc", id: 오래된 },
			지금 - 31 * DAY,
		);
		await applyArchiveOp(db, u, { kind: "trashDoc", id: 최근 }, 지금 - 1 * DAY);

		await sweepExpired(db, u, 지금);

		const 뒤 = await readArchive(db, u);
		expect(뒤.trash.map((t) => t.id)).toEqual([최근]);
		// 비운 것은 자취를 남긴다 — 안 남기면 다음 동기화에 되살아난다
		expect(await takenIds(db, u)).toContain(오래된);
	});

	it("비울 것이 없으면 아무 일도 없다", async () => {
		const u = await 사람("만료-없음");
		await 원고(u);
		await expect(sweepExpired(db, u)).resolves.toBeUndefined();
		expect((await readArchive(db, u)).docs).toHaveLength(1);
	});
});

describe("복제", () => {
	it("본문까지 뜬다", async () => {
		/*
		 * 브라우저를 시키지 않는다 — 열어 본 적 없는 원고를 목록에서 바로 복제할
		 * 수 있어서, 그쪽이 본문을 들고 있다는 보장이 없다.
		 */
		const u = await 사람("복제-본문");
		const docId = await 원고(u, { title: "원본", body: "베껴질 글" });

		const { index } = await applyArchiveOp(db, u, {
			kind: "duplicateDoc",
			id: docId,
		});
		const 사본 = index.docs.find((d) => d.id !== docId);

		expect(사본?.title).toBe("원본 (사본)");
		expect(await readDocContent(db, u, 사본?.id ?? "")).toEqual(
			글("베껴질 글"),
		);
	});

	it("사본은 제 id를 받는다", async () => {
		const u = await 사람("복제-id");
		const docId = await 원고(u);
		const { index } = await applyArchiveOp(db, u, {
			kind: "duplicateDoc",
			id: docId,
		});

		expect(index.docs).toHaveLength(2);
		expect(new Set(index.docs.map((d) => d.id)).size).toBe(2);
	});
});
