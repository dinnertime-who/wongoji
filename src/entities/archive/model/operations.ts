import { TRASH_DAYS } from "../config/limits";
import {
	ancestorIds,
	canMoveFolder,
	fullPath,
	isUnder,
	ROOT,
	settleUnder,
} from "../lib/path";
import {
	type DocEntry,
	type FolderEntry,
	INDEX_VERSION,
	type Path,
	type StoreIndex,
	type TrashEntry,
} from "./types";

/**
 * 색인을 다루는 순수 함수들.
 *
 * 모두 새 색인을 돌려준다 — 저장은 부르는 쪽이 한다. 이렇게 두면 저장 실패를
 * 화면에 알리는 일과 자료를 고치는 일이 섞이지 않는다.
 */

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

// ─── 차례 ───

/**
 * 형제 사이의 차례.
 *
 * **`order`가 같은 둘이 있을 수 있다.** 아직 한 번도 사람이 순서를 손대지 않은
 * 자리다 — 경로가 고쳐지며 다른 자리로 온 것, 옛 서버 행. 그때는 이 앱이 순서를
 * 두기 전에 쓰던 정렬로 가른다. 마지막에 id를 보는 것은 **전순서로 만들기
 * 위해서다**. 이름도 시각도 같은 둘이 있으면 그리는 차례가 그릴 때마다 달라진다.
 */
const byFolderOrder = (a: FolderEntry, b: FolderEntry): number =>
	a.order - b.order ||
	a.name.localeCompare(b.name, "ko") ||
	a.id.localeCompare(b.id);

const byDocOrder = (a: DocEntry, b: DocEntry): number =>
	a.order - b.order || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id);

const siblingFolders = (index: StoreIndex, path: Path): FolderEntry[] =>
	index.folders.filter((f) => f.path === path).sort(byFolderOrder);

const siblingDocs = (index: StoreIndex, path: Path): DocEntry[] =>
	index.docs.filter((d) => d.path === path).sort(byDocOrder);

/** 그 자리 맨 끝에 붙일 번호 */
const endOrder = (siblings: readonly { order: number }[]): number =>
	siblings.reduce((n, s) => Math.max(n, s.order + 1), 0);

/**
 * 한 형제 목록을 0부터 다시 번호 매겨 전체 배열에 되돌린다.
 *
 * 번호가 그대로인 항목은 **같은 객체를 돌려준다.** 이 색인을 구독하는 화면이
 * 있어서, 손대지 않은 줄까지 새 객체가 되면 그것이 다시 그릴 이유가 된다.
 * 하나도 바뀌지 않았으면 배열 자체를 그대로 돌려준다 — 그래야 부르는 쪽이
 * "아무 일도 없었다"를 알아볼 수 있다.
 */
function renumber<T extends { id: string; order: number }>(
	all: T[],
	ordered: readonly T[],
): T[] {
	const at = new Map(ordered.map((e, i) => [e.id, i]));
	let changed = false;
	const next = all.map((e) => {
		const order = at.get(e.id);
		if (order === undefined || order === e.order) return e;
		changed = true;
		return { ...e, order };
	});
	return changed ? next : all;
}

// ─── 만들기 ───

export function createFolder(
	index: StoreIndex,
	name: string,
	path: Path = ROOT,
	newId: NewId = makeId,
): { index: StoreIndex; folder: FolderEntry } {
	const folder: FolderEntry = {
		id: newId(),
		name,
		path,
		// 새로 만든 것은 맨 끝에 붙는다. 쌓아 가는 목록이다
		order: endOrder(index.folders.filter((f) => f.path === path)),
	};
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
		order: endOrder(index.docs.filter((d) => d.path === path)),
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
 * **원본 바로 아래에 놓는다.** 맨 끝으로 보내면 목록이 긴 폴더에서 사본이 어디
 * 갔는지 찾아 내려가야 한다. 복제는 원본 옆에 두고 견주려고 하는 일이다.
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

	const draft: DocEntry = {
		...source,
		id: newId(),
		title: copyTitle(
			source.title,
			index.docs.filter((d) => d.path === source.path).map((d) => d.title),
		),
		createdAt: now,
		updatedAt: now,
	};

	// 원본 다음 형제 앞에 끼운다. 원본이 마지막이면 그대로 맨 끝이다
	const added = { ...index, docs: [...index.docs, draft] };
	const others = siblingDocs(added, source.path).filter(
		(d) => d.id !== draft.id,
	);
	const before =
		others[others.findIndex((d) => d.id === source.id) + 1]?.id ?? null;

	const next = placeEntry(
		added,
		{ kind: "doc", id: draft.id },
		{
			path: source.path,
			before,
		},
	);
	return {
		index: next,
		doc: next.docs.find((d) => d.id === draft.id) ?? draft,
	};
}

// ─── 고치기 ───

export function updateDoc(
	index: StoreIndex,
	id: string,
	patch: Partial<Omit<DocEntry, "id" | "createdAt">>,
	now = Date.now(),
): StoreIndex {
	// 없는 원고면 받은 것을 그대로 돌려준다. 새 객체를 주면 부르는 쪽이 그것을
	// 저장하고, 저장은 화면을 다시 그리게 하고 서버로 밀어 넣기까지 예약한다
	if (!index.docs.some((d) => d.id === id)) return index;

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
	// 없는 폴더이거나 같은 이름이면 아무 일도 하지 않는다 — `placeEntry`가
	// 제자리에 놓을 때와 같다. 여기서 새 객체를 주면 그 한 번에 저장과 다시
	// 그리기와 서버로 밀어 넣기가 다 돈다
	const folder = index.folders.find((f) => f.id === id);
	if (!folder || folder.name === name) return index;

	return {
		...index,
		folders: index.folders.map((f) => (f.id === id ? { ...f, name } : f)),
	};
}

// ─── 옮기기 ───

/** 무엇을 옮기는가. 폴더는 제 자손에 들어갈 수 없어 종류를 알아야 한다 */
export interface Moving {
	kind: "doc" | "folder";
	id: string;
}

/** 어디에 놓는가 */
export interface Placement {
	path: Path;
	/**
	 * 이 형제 **앞**에 끼운다. null이면 맨 끝.
	 *
	 * 자리 번호가 아니라 id다. 번호는 이 함수가 다시 매기는 값이라 부르는 쪽이
	 * 붙들고 있으면 어긋나고, id는 목록이 어떻게 바뀌어도 무엇을 가리키는지가
	 * 변하지 않는다.
	 */
	before: string | null;
}

/**
 * 폴더와 그 아래 전부의 경로를 다시 쓴다.
 *
 * 갈 수 있는 자리인지는 부르는 쪽이 이미 보았다.
 */
function rewritePaths(
	index: StoreIndex,
	folder: FolderEntry,
	toPath: Path,
): StoreIndex {
	const from = fullPath(folder);
	const to = `${toPath}${folder.id}/`;
	const rewrite = <T extends { path: Path }>(item: T): T =>
		isUnder(item.path, from)
			? { ...item, path: to + item.path.slice(from.length) }
			: item;

	return {
		...index,
		folders: index.folders.map((f) =>
			f.id === folder.id ? { ...f, path: toPath } : rewrite(f),
		),
		docs: index.docs.map(rewrite),
	};
}

/**
 * 이미 경로가 다시 써진 배열에서 자리만 잡는다.
 *
 * `from`은 떠나온 자리다. 다른 폴더에서 왔으면 거기 남은 형제들도 다시 번호
 * 매긴다 — 빈틈이 정렬을 해치지는 않지만, 두 자리 모두 빽빽하다는 약속을
 * 지키면 다음에 무슨 일이 있었는지 읽기가 쉽다.
 */
function place<T extends { id: string; path: Path; order: number }>(
	all: T[],
	id: string,
	to: Placement,
	from: Path,
	compare: (a: T, b: T) => number,
): T[] {
	// 제 앞에 놓는 것은 제자리에 두는 것이다
	if (to.before === id) return all;

	const here = all.filter((e) => e.path === to.path).sort(compare);
	const moving = here.find((e) => e.id === id);
	if (!moving) return all;

	const rest = here.filter((e) => e.id !== id);
	const at =
		to.before === null ? -1 : rest.findIndex((e) => e.id === to.before);
	const ordered =
		at < 0
			? [...rest, moving]
			: [...rest.slice(0, at), moving, ...rest.slice(at)];

	const next = renumber(all, ordered);
	if (from === to.path) return next;
	return renumber(next, next.filter((e) => e.path === from).sort(compare));
}

/**
 * 옮기고 자리를 잡는다. **보관함에서 무엇이 움직이는 길은 이것 하나다.**
 *
 * 끌어다 놓는 것도, ⋯ 메뉴의 이동도, 위·아래로 미는 것도 모두 여기로 온다.
 * 전에는 `moveDoc`·`moveFolder`가 경로만 갈아 끼웠는데, 자리라는 개념이 생긴
 * 뒤로는 그 둘을 남겨 두면 **순서를 잊고 옮기는 길**이 함께 남는 셈이다.
 *
 * 폴더는 자기 자신이나 자기 자손 안으로 갈 수 없다 — 순환이 생기면 트리가
 * 끊긴다. 갈 수 없으면 색인을 그대로 돌려준다.
 */
export function placeEntry(
	index: StoreIndex,
	moving: Moving,
	to: Placement,
): StoreIndex {
	if (moving.kind === "folder") {
		const folder = index.folders.find((f) => f.id === moving.id);
		if (!folder || !canMoveFolder(folder, to.path)) return index;

		const from = folder.path;
		const moved =
			from === to.path ? index : rewritePaths(index, folder, to.path);
		const folders = place(moved.folders, folder.id, to, from, byFolderOrder);
		/*
		 * 아무것도 바뀌지 않았으면 **받은 것을 그대로 돌려준다.** 같은 내용의 새
		 * 객체를 주면 부르는 쪽이 그것을 저장하고, 저장은 화면을 다시 그리게 하고
		 * 서버로 밀어 넣기까지 예약한다 — 제자리에 놓은 한 번에 그 줄이 다 돈다.
		 */
		return moved === index && folders === index.folders
			? index
			: { ...moved, folders };
	}

	const doc = index.docs.find((d) => d.id === moving.id);
	if (!doc) return index;

	const from = doc.path;
	const moved =
		from === to.path
			? index
			: {
					...index,
					docs: index.docs.map((d) =>
						d.id === doc.id ? { ...d, path: to.path } : d,
					),
				};
	const docs = place(moved.docs, doc.id, to, from, byDocOrder);
	return moved === index && docs === index.docs ? index : { ...moved, docs };
}

/**
 * 형제 사이에서 한 칸 민다. 키보드와 ⋯ 메뉴가 쓴다.
 *
 * 끌어 놓기는 마우스와 손가락의 것이라, 그것만 두면 키보드로는 순서를 바꿀 길이
 * 없다. 트리의 이동 메뉴가 이미 같은 짝을 이루고 있다.
 *
 * 끝에서 더 밀면 아무 일도 없다.
 */
export function nudgeEntry(
	index: StoreIndex,
	moving: Moving,
	dir: -1 | 1,
): StoreIndex {
	const entry =
		moving.kind === "folder"
			? index.folders.find((f) => f.id === moving.id)
			: index.docs.find((d) => d.id === moving.id);
	if (!entry) return index;

	const siblings: { id: string }[] =
		moving.kind === "folder"
			? siblingFolders(index, entry.path)
			: siblingDocs(index, entry.path);

	const at = siblings.findIndex((s) => s.id === moving.id);
	const to = at + dir;
	if (at < 0 || to < 0 || to >= siblings.length) return index;

	/*
	 * 위로 가면 앞 형제의 앞에, 아래로 가면 다음다음 형제의 앞에 끼운다.
	 * 마지막 바로 앞에서 아래로 가면 다음다음이 없다 — 맨 끝이라는 뜻이다.
	 */
	const before = dir === -1 ? siblings[to].id : (siblings[to + 1]?.id ?? null);
	return placeEntry(index, moving, { path: entry.path, before });
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

	/*
	 * 되살아난 것은 제 자리 맨 끝으로 간다. 휴지통이 순서를 들고 가지 않기
	 * 때문이다(`TrashEntry` 참고). 하나씩 밀어 넣으므로 함께 돌아온 것들끼리는
	 * 버릴 때의 차례가 그대로 남는다.
	 */
	const folders = [...index.folders];
	const docs = [...index.docs];
	for (const item of coming) {
		const path = settleUnder(item.path, alive);
		if (item.kind === "folder") {
			folders.push({
				id: item.id,
				name: item.name,
				path,
				order: endOrder(folders.filter((f) => f.path === path)),
			});
		} else {
			docs.push(
				reviveDoc(item, path, endOrder(docs.filter((d) => d.path === path))),
			);
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
	order: number,
	now = Date.now(),
): DocEntry {
	return {
		id: entry.id,
		title: entry.title,
		path,
		order,
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

/*
 * 기한이 지난 것을 비우는 일은 여기 없다. **서버가 한다**(`sweepExpired`) —
 * 보관함을 읽기 전에 한 번. 전에는 앱을 열 때 브라우저가 비웠는데, 그 사실이
 * 서버로 갈 길이 없어서 다음에 받아 올 때 그대로 되살아났다.
 */

/** 남은 날. 0이면 다음에 열 때 사라진다 */
export const daysLeft = (
	entry: TrashEntry,
	now = Date.now(),
	days = TRASH_DAYS,
): number => Math.max(0, Math.ceil((entry.deletedAt + days * DAY - now) / DAY));

// ─── 다듬기 ───

/*
 * 끊어진 경로를 고치는 일도 여기 없다. 폴더를 지우면 그 아래가 함께 가고
 * (`purge`), 되살릴 때는 `settleUnder`가 살아 있는 조상까지 끌어올린다 —
 * 고치는 쪽이 서버 하나뿐이라 끊긴 채로 남을 자리가 없어졌다.
 */

// ─── 읽기 ───

/**
 * 목록에 보여줄 이름.
 *
 * 제목은 비어 있을 수 있다 — 원고지 첫 장에 조판되는 값이라, 사용자가 적지 않았는데
 * 자리를 채워 넣으면 쓰지도 않은 제목이 원고에 찍힌다. 빈 것은 목록에서만 메운다.
 */
export const displayTitle = (entry: { title: string }): string =>
	entry.title.trim() || "제목 없는 원고";

/**
 * 그 폴더 바로 아래 것들. **폴더가 먼저, 그 안에서는 사람이 정한 차례대로.**
 *
 * 전에는 폴더를 이름순, 원고를 최근 수정순으로 늘어놓았다. 원고 쪽은 고칠
 * 때마다 목록에서 맨 위로 튀어 오른다는 뜻이었다 — 손대지 않은 것이 아래로
 * 밀려나는 것이라, 차례를 스스로 정해 둔 사람에게는 그것이 어긋남이다.
 */
export function childrenOf(index: StoreIndex, path: Path) {
	return {
		folders: siblingFolders(index, path),
		docs: siblingDocs(index, path),
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

// ─── 계정으로 올릴 때 ───

/**
 * 계정에 이미 쓰인 id를 피해 다시 매긴다.
 *
 * 로컬 id는 여덟 자 난수라 "한 브라우저 안에서만" 유일하다. 다른 기기에서 쓴
 * 원고가 이미 계정에 있으면 부딪힐 수 있고, 그대로 올리면 남의 원고를 덮어쓴다.
 *
 * **경로 문자열도 함께 고쳐야 한다.** 폴더 id는 `path` 안에 박혀 있어서(mpath),
 * 폴더만 새 id를 받고 경로를 그대로 두면 그 아래 원고들이 사라진 폴더를 가리킨다.
 *
 * 겹치지 않는 id는 그대로 둔다 — 대개는 하나도 안 겹쳐서 아무 일도 일어나지
 * 않는다. 어느 것이 어떻게 바뀌었는지 함께 돌려준다. 본문을 새 id로 올려야 한다.
 */
export function remapIds(
	index: StoreIndex,
	taken: ReadonlySet<string>,
	newId: NewId = makeId,
): { index: StoreIndex; renamed: Map<string, string> } {
	const renamed = new Map<string, string>();
	const used = new Set(taken);

	const claim = (id: string) => {
		if (!used.has(id)) {
			used.add(id);
			return;
		}
		let next = newId();
		while (used.has(next)) next = newId();
		used.add(next);
		renamed.set(id, next);
	};

	for (const f of index.folders) claim(f.id);
	for (const d of index.docs) claim(d.id);
	for (const t of index.trash) claim(t.id);

	if (renamed.size === 0) return { index, renamed };

	const settle = (path: Path): Path => {
		const ids = ancestorIds(path).map((id) => renamed.get(id) ?? id);
		return ids.length ? `/${ids.join("/")}/` : ROOT;
	};

	return {
		index: {
			version: INDEX_VERSION,
			folders: index.folders.map((f) => ({
				...f,
				id: renamed.get(f.id) ?? f.id,
				path: settle(f.path),
			})),
			docs: index.docs.map((d) => ({
				...d,
				id: renamed.get(d.id) ?? d.id,
				path: settle(d.path),
			})),
			trash: index.trash.map((t) => ({
				...t,
				id: renamed.get(t.id) ?? t.id,
				path: settle(t.path),
			})),
		},
		renamed,
	};
}
