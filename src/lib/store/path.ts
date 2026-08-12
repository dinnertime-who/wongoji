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

/** 위에서부터 늘어놓은 조상 id들. 브레드크럼이 이것이다 */
export function ancestorIds(path: Path): string[] {
	return path.split("/").filter(Boolean);
}

/** `ancestor` 아래에 있는가. 자기 자신은 아니다 */
export const isUnder = (path: Path, ancestorFull: Path): boolean =>
	path.startsWith(ancestorFull);

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

/**
 * 살아 있는 조상까지만 남긴 경로.
 *
 * 폴더가 사라졌는데 그 아래를 가리키는 것이 남아 있으면 화면에서 영영 보이지
 * 않는다. 사슬을 위에서부터 훑다가 처음 끊긴 자리에서 멈춘다 — 거기까지가
 * 실제로 갈 수 있는 곳이고, 하나도 못 가면 root다.
 *
 * 휴지통에서 되살릴 때와 앱을 열 때 다듬을 때 둘 다 이 규칙이다. 두 곳이
 * 달라지면 원고가 트리에서 사라지므로 한 벌만 둔다. 무엇을 살아 있다고 볼지는
 * 부르는 쪽이 정한다 — 되살릴 때는 함께 돌아오는 폴더도 살아 있는 것이다.
 */
export function settleUnder(path: Path, alive: ReadonlySet<string>): Path {
	const kept: string[] = [];
	for (const id of ancestorIds(path)) {
		if (!alive.has(id)) break;
		kept.push(id);
	}
	return kept.length ? `/${kept.join("/")}/` : ROOT;
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
