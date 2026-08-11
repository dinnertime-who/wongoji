import type { FolderEntry, Path } from "./types";

/** 보이지 않는 최상위. 화면에 폴더로 그리지 않고, 지워지지도 않는다 */
export const ROOT: Path = "/";

/**
 * 그 항목까지 포함한 경로.
 *
 * `path`는 조상들만 담으므로, 자손을 찾으려면 자기 id를 붙인 것으로 견줘야 한다.
 * 예: `{ id: "f2", path: "/f1/" }` → `/f1/f2/`
 */
export const fullPath = (entry: { id: string; path: Path }): Path =>
	`${entry.path}${entry.id}/`;

/** 바로 위 폴더의 id. root 바로 아래면 null */
export function parentId(path: Path): string | null {
	const ids = ancestorIds(path);
	return ids.length ? ids[ids.length - 1] : null;
}

/** 위에서부터 늘어놓은 조상 id들. 브레드크럼이 이것이다 */
export function ancestorIds(path: Path): string[] {
	return path.split("/").filter(Boolean);
}

/** `ancestor` 아래에 있는가. 자기 자신은 아니다 */
export const isUnder = (path: Path, ancestorFull: Path): boolean =>
	path.startsWith(ancestorFull);

/**
 * 옮긴 뒤의 경로.
 *
 * mpath의 대가가 여기다 — 폴더를 옮기면 그 아래 전부의 경로를 고쳐야 한다.
 * 색인이 어차피 JSON 한 덩어리라 통째로 다시 쓰므로 실제 비용은 아니다.
 */
export const reparent = (path: Path, fromFull: Path, toFull: Path): Path =>
	path.startsWith(fromFull) ? toFull + path.slice(fromFull.length) : path;

/**
 * 그 폴더 안으로 옮길 수 있는가.
 *
 * 자기 자신이나 자기 자손 안으로 옮기면 순환이 생겨 트리가 끊긴다.
 * 옮기려는 폴더의 전체 경로가 목적지 경로의 앞머리인지 보면 된다.
 */
export function canMoveFolder(folder: FolderEntry, toPath: Path): boolean {
	const own = fullPath(folder);
	if (toPath === own) return false;
	return !toPath.startsWith(own);
}

/** 경로를 이름으로 옮긴다. 중간에 사라진 폴더가 있으면 거기서 멈춘다 */
export function pathNames(path: Path, folders: FolderEntry[]): string[] {
	const byId = new Map(folders.map((f) => [f.id, f]));
	const names: string[] = [];
	for (const id of ancestorIds(path)) {
		const folder = byId.get(id);
		if (!folder) break;
		names.push(folder.name);
	}
	return names;
}
