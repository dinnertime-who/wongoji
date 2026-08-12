import { canMoveFolder, fullPath, isUnder, ROOT, settleUnder } from "./path";
import type {
	DocEntry,
	FolderEntry,
	Path,
	StoreIndex,
	TrashEntry,
} from "./types";

/**
 * 색인을 다루는 순수 함수들.
 *
 * 모두 새 색인을 돌려준다 — 저장은 부르는 쪽이 한다. 이렇게 두면 저장 실패를
 * 화면에 알리는 일과 자료를 고치는 일이 섞이지 않는다.
 */

/** 휴지통에 머무는 기간 */
export const TRASH_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

/**
 * 짧은 무작위 id.
 *
 * `crypto.randomUUID()`는 길어서 경로 문자열이 지저분해진다. 한 브라우저 안에서만
 * 유일하면 되므로 이 길이로 충분하다. 만드는 쪽을 갈아끼울 수 있게 인자로 받는다.
 */
export function makeId(): string {
	return Math.random().toString(36).slice(2, 10);
}

type NewId = () => string;

// ─── 만들기 ───

export function createFolder(
	index: StoreIndex,
	name: string,
	path: Path = ROOT,
	newId: NewId = makeId,
): { index: StoreIndex; folder: FolderEntry } {
	const folder: FolderEntry = { id: newId(), name, path };
	return { index: { ...index, folders: [...index.folders, folder] }, folder };
}

export function createDoc(
	index: StoreIndex,
	{ title = "", path = ROOT, now = Date.now() } = {},
	newId: NewId = makeId,
): { index: StoreIndex; doc: DocEntry } {
	const doc: DocEntry = {
		id: newId(),
		title,
		path,
		goal: 0,
		chars: 0,
		sheets: 1,
		createdAt: now,
		updatedAt: now,
	};
	return { index: { ...index, docs: [...index.docs, doc] }, doc };
}

/** 끝에 붙은 사본 표시 — `(사본)`, `(사본 2)` */
const COPY_SUFFIX = /\s*\(사본(?: \d+)?\)$/;

/**
 * 사본에 붙일 제목.
 *
 * 같은 폴더에 이미 같은 이름이 있으면 번호를 올린다. 이미 사본인 것을 또 복제할
 * 때 `(사본) (사본)`으로 늘어지지 않게 꼬리를 떼고 다시 붙인다.
 */
export function copyTitle(title: string, taken: readonly string[]): string {
	const base = title.trim();
	// 제목이 없으면 사본도 없는 채로 둔다. 없던 제목을 지어내면 내보낸 문서에 찍힌다
	if (!base) return "";

	const stem = base.replace(COPY_SUFFIX, "");
	const used = new Set(taken.map((t) => t.trim()));

	let name = `${stem} (사본)`;
	for (let n = 2; used.has(name); n += 1) name = `${stem} (사본 ${n})`;
	return name;
}

/**
 * 원고를 복제한다. 같은 폴더에 사본 제목으로 넣는다.
 *
 * 본문은 여기서 옮기지 않는다 — 색인에 없는 값이라 부르는 쪽이 키를 복사한다.
 * 없는 원고면 null을 돌려준다.
 */
export function duplicateDoc(
	index: StoreIndex,
	id: string,
	now = Date.now(),
	newId: NewId = makeId,
): { index: StoreIndex; doc: DocEntry } | null {
	const source = index.docs.find((d) => d.id === id);
	if (!source) return null;

	const doc: DocEntry = {
		...source,
		id: newId(),
		title: copyTitle(
			source.title,
			index.docs.filter((d) => d.path === source.path).map((d) => d.title),
		),
		createdAt: now,
		updatedAt: now,
	};
	return { index: { ...index, docs: [...index.docs, doc] }, doc };
}

// ─── 고치기 ───

export function updateDoc(
	index: StoreIndex,
	id: string,
	patch: Partial<Omit<DocEntry, "id" | "createdAt">>,
	now = Date.now(),
): StoreIndex {
	return {
		...index,
		docs: index.docs.map((d) =>
			d.id === id ? { ...d, ...patch, updatedAt: now } : d,
		),
	};
}

export function renameFolder(
	index: StoreIndex,
	id: string,
	name: string,
): StoreIndex {
	return {
		...index,
		folders: index.folders.map((f) => (f.id === id ? { ...f, name } : f)),
	};
}

// ─── 옮기기 ───

export function moveDoc(
	index: StoreIndex,
	id: string,
	toPath: Path,
): StoreIndex {
	return {
		...index,
		docs: index.docs.map((d) => (d.id === id ? { ...d, path: toPath } : d)),
	};
}

/**
 * 폴더를 옮긴다. 그 아래 전부의 경로가 함께 따라간다.
 *
 * 자기 자신이나 자기 자손 안으로는 옮기지 못한다 — 순환이 생기면 트리가 끊긴다.
 * 옮길 수 없으면 색인을 그대로 돌려준다.
 */
export function moveFolder(
	index: StoreIndex,
	id: string,
	toPath: Path,
): StoreIndex {
	const folder = index.folders.find((f) => f.id === id);
	if (!folder || !canMoveFolder(folder, toPath)) return index;

	const from = fullPath(folder);
	const to = `${toPath}${id}/`;
	const rewrite = <T extends { path: Path }>(item: T): T =>
		isUnder(item.path, from)
			? { ...item, path: to + item.path.slice(from.length) }
			: item;

	return {
		...index,
		folders: index.folders.map((f) =>
			f.id === id ? { ...f, path: toPath } : rewrite(f),
		),
		docs: index.docs.map(rewrite),
	};
}

// ─── 버리기 · 되살리기 ───

/** 폴더를 버리면 그 아래 전부가 함께 간다 */
export function trashFolder(
	index: StoreIndex,
	id: string,
	now = Date.now(),
): StoreIndex {
	const folder = index.folders.find((f) => f.id === id);
	if (!folder) return index;

	const under = fullPath(folder);
	const goes = <T extends { id: string; path: Path }>(item: T) =>
		item.id === id || isUnder(item.path, under);

	const trashed: TrashEntry[] = [
		...index.folders.filter(goes).map(
			(f): TrashEntry => ({
				kind: "folder",
				id: f.id,
				name: f.name,
				path: f.path,
				deletedAt: now,
			}),
		),
		...index.docs
			.filter((d) => isUnder(d.path, under))
			.map(
				(d): TrashEntry => ({
					kind: "doc",
					id: d.id,
					title: d.title,
					goal: d.goal,
					path: d.path,
					deletedAt: now,
				}),
			),
	];

	return {
		...index,
		folders: index.folders.filter((f) => !goes(f)),
		docs: index.docs.filter((d) => !isUnder(d.path, under)),
		trash: [...index.trash, ...trashed],
	};
}

export function trashDoc(
	index: StoreIndex,
	id: string,
	now = Date.now(),
): StoreIndex {
	const doc = index.docs.find((d) => d.id === id);
	if (!doc) return index;
	return {
		...index,
		docs: index.docs.filter((d) => d.id !== id),
		trash: [
			...index.trash,
			{
				kind: "doc",
				id,
				title: doc.title,
				goal: doc.goal,
				path: doc.path,
				deletedAt: now,
			},
		],
	};
}

/**
 * 되살린다. 함께 버려진 것들도 함께 온다.
 *
 * 원래 자리가 사라졌으면 살아 있는 가장 가까운 조상으로, 거기까지 없으면 root로
 * 올린다. root는 지워지지 않으므로 갈 곳이 없는 경우는 생기지 않는다.
 */
export function restore(index: StoreIndex, id: string): StoreIndex {
	const entry = index.trash.find((t) => t.id === id);
	if (!entry) return index;

	const under = entry.kind === "folder" ? `${entry.path}${entry.id}/` : null;
	const coming = index.trash.filter(
		(t) => t.id === id || (under !== null && isUnder(t.path, under)),
	);
	const rest = index.trash.filter((t) => !coming.includes(t));

	// 되살아난 폴더까지 셈에 넣어야 함께 오는 것들의 자리가 잡힌다
	const alive = new Set([
		...index.folders.map((f) => f.id),
		...coming.filter((t) => t.kind === "folder").map((t) => t.id),
	]);

	const folders = [...index.folders];
	const docs = [...index.docs];
	for (const item of coming) {
		const path = settleUnder(item.path, alive);
		if (item.kind === "folder") {
			folders.push({ id: item.id, name: item.name, path });
		} else {
			docs.push(reviveDoc(item, path));
		}
	}

	return { ...index, folders, docs, trash: rest };
}

/**
 * 되살린 원고.
 *
 * 제목과 목표는 버릴 때 들고 갔으므로 그대로 돌려준다. 분량은 본문을 다시 읽어야
 * 나오는 값이라 0으로 두고, 원고를 열 때 채운다.
 */
function reviveDoc(
	entry: Extract<TrashEntry, { kind: "doc" }>,
	path: Path,
	now = Date.now(),
): DocEntry {
	return {
		id: entry.id,
		title: entry.title,
		path,
		goal: entry.goal,
		chars: 0,
		sheets: 1,
		createdAt: now,
		updatedAt: now,
	};
}

/**
 * 되돌릴 수 없는 삭제.
 *
 * 폴더를 지우면 그 아래 것들도 함께 간다 — 버릴 때 함께 왔고, 되살릴 때도 함께
 * 오므로 지울 때만 남겨 두면 갈 곳 없는 항목이 된다. 목록이 "원고 3편"이라고
 * 적어 두는 것도 이 약속이다.
 */
export function purge(
	index: StoreIndex,
	ids: string[],
): {
	index: StoreIndex;
	removedDocIds: string[];
} {
	const gone = new Set(ids);

	// 지우기로 한 폴더들의 안쪽 경로. 그 아래 있는 휴지통 항목이 함께 간다
	const under = index.trash
		.filter((t) => gone.has(t.id) && t.kind === "folder")
		.map(fullPath);
	const goes = (entry: TrashEntry) =>
		gone.has(entry.id) || under.some((u) => isUnder(entry.path, u));

	const removedDocIds = index.trash
		.filter((t) => t.kind === "doc" && goes(t))
		.map((t) => t.id);

	return {
		index: { ...index, trash: index.trash.filter((t) => !goes(t)) },
		removedDocIds,
	};
}

/** 기한이 지난 것을 비운다. 앱을 열 때 한 번 부른다 */
export function purgeExpired(
	index: StoreIndex,
	now = Date.now(),
	days = TRASH_DAYS,
): { index: StoreIndex; removedDocIds: string[] } {
	const cutoff = now - days * DAY;
	const expired = index.trash
		.filter((t) => t.deletedAt < cutoff)
		.map((t) => t.id);
	return purge(index, expired);
}

/** 남은 날. 0이면 다음에 열 때 사라진다 */
export const daysLeft = (
	entry: TrashEntry,
	now = Date.now(),
	days = TRASH_DAYS,
): number => Math.max(0, Math.ceil((entry.deletedAt + days * DAY - now) / DAY));

// ─── 다듬기 ───

/**
 * 끊어진 경로를 고친다.
 *
 * 폴더가 사라졌는데 그 아래를 가리키는 것이 남아 있으면 화면에서 영영 보이지
 * 않는다. 살아 있는 가장 가까운 조상까지 끌어올린다.
 */
export function repairPaths(index: StoreIndex): StoreIndex {
	const alive = new Set(index.folders.map((f) => f.id));
	const settle = (path: Path) => settleUnder(path, alive);

	return {
		...index,
		folders: index.folders.map((f) => ({ ...f, path: settle(f.path) })),
		docs: index.docs.map((d) => ({ ...d, path: settle(d.path) })),
	};
}

// ─── 읽기 ───

/**
 * 목록에 보여줄 이름.
 *
 * 제목은 비어 있을 수 있다 — 원고지 첫 장에 조판되는 값이라, 사용자가 적지 않았는데
 * 자리를 채워 넣으면 쓰지도 않은 제목이 원고에 찍힌다. 빈 것은 목록에서만 메운다.
 */
export const displayTitle = (entry: { title: string }): string =>
	entry.title.trim() || "제목 없는 원고";

/** 그 폴더 바로 아래 것들. 폴더가 먼저, 이름순 · 원고는 최근 수정순 */
export function childrenOf(index: StoreIndex, path: Path) {
	return {
		folders: index.folders
			.filter((f) => f.path === path)
			.sort((a, b) => a.name.localeCompare(b.name, "ko")),
		docs: index.docs
			.filter((d) => d.path === path)
			.sort((a, b) => b.updatedAt - a.updatedAt),
	};
}

/** 그 폴더 아래에 든 원고 수 — 휴지통에서 "원고 3편"을 보여줄 때 쓴다 */
export function countDocsUnder(index: StoreIndex, folderId: string): number {
	const entry =
		index.folders.find((f) => f.id === folderId) ??
		index.trash.find((t) => t.id === folderId && t.kind === "folder");
	if (!entry) return 0;
	const under = fullPath(entry);
	return (
		index.docs.filter((d) => isUnder(d.path, under)).length +
		index.trash.filter((t) => t.kind === "doc" && isUnder(t.path, under)).length
	);
}

/**
 * 보관함이 쓴 분량과 그 한계.
 *
 * 매수로 잰다. 바이트로 적으면 얼마나 더 쓸 수 있는지 가늠할 수 없지만, 매수는
 * 원고지를 쓰는 사람이 이미 아는 단위다.
 *
 * 휴지통은 세지 않는다. 30일 뒤 저절로 비워지는 것이라 지금 쓴 분량으로 보기
 * 어렵고, 휴지통은 제 개수를 따로 보여준다.
 */
export const SHEET_LIMIT = 100;

/** 목록에 든 값을 더한다. 세느라 원고를 열지 않는다 */
export function usedSheets(index: StoreIndex): number {
	return index.docs.reduce((sum, doc) => sum + doc.sheets, 0);
}
