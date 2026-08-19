import {
	type DocEntry,
	type FolderEntry,
	fullPath,
	isUnder,
	type Path,
	ROOT,
	type StoreIndex,
} from "#/entities/archive";
import { safeFileName } from "#/entities/manuscript";

/**
 * 보관함을 zip 안의 경로로 옮긴다.
 *
 * **순수 함수다.** 파일을 읽거나 zip을 만드는 일은 `api`가 한다 — 여기 있는 것은
 * "어느 원고가 어느 경로에 놓이는가"뿐이고, 그것이 이 기능에서 틀리기 쉬운 전부다.
 *
 * 틀릴 자리가 셋이다.
 *
 * 1. **이름이 겹친다.** 보관함은 같은 폴더에 같은 제목의 원고를 허용한다(복제가
 *    `제목 (사본)`을 붙이지만 손으로 고치면 그만이다). 파일 시스템은 허용하지
 *    않는다 — 손대지 않으면 **뒤엣것이 앞엣것을 조용히 덮는다.**
 * 2. **이름에 슬래시가 들어간다.** `safeFileName`이 걷어내지만, 걷어낸 결과가
 *    빈 문자열일 수 있고 그러면 경로가 무너진다.
 * 3. **폴더가 깊다.** 조상을 거슬러 올라가며 이름을 이어야 하는데, 색인은
 *    조상 id 사슬(`path`)만 들고 있다.
 */

/** zip에 넣을 파일 하나 */
export interface ZipEntry {
	/** zip 안의 경로. 슬래시로 잇는다 */
	path: string;
	/** 이 파일이 담을 원고 */
	docId: string;
	/** 제목. 파일 첫 줄에 들어간다 */
	title: string;
}

/**
 * 어디를 담는가. 보관함 전체이거나, 폴더 하나 아래다.
 *
 * **폴더를 담을 때는 그 폴더가 zip 안의 맨 위 칸이 된다.** 원고 한 편짜리 폴더를
 * 받으면 zip 안에 파일 하나만 남는데, 그때 푸는 도구 대부분은 폴더를 만들지 않고
 * 파일을 그냥 꺼내 놓는다 — 어느 폴더에서 온 것인지가 거기서 사라진다.
 */
export type ZipScope =
	| { kind: "all" }
	| { kind: "folder"; folder: FolderEntry };

/** 보관함 전체. 기본값이자 발치의 "전체 받기"가 쓰는 것 */
export const WHOLE_ARCHIVE: ZipScope = { kind: "all" };

/** 이름이 겹치면 뒤엣것부터 `(2)`, `(3)`을 붙인다 */
function unique(taken: Set<string>, name: string, ext: string): string {
	const base = name || "제목 없음";
	let candidate = `${base}${ext}`;
	let nth = 2;
	while (taken.has(candidate.toLowerCase())) {
		candidate = `${base} (${nth})${ext}`;
		nth += 1;
	}
	taken.add(candidate.toLowerCase());
	return candidate;
}

/**
 * 폴더 id → zip 안의 그 폴더 경로.
 *
 * `from` 아래만 짓는다 — 폴더 하나를 받을 때는 그 폴더 바깥을 알 필요가 없고,
 * 알면 zip에 넣지도 않을 경로를 짓게 된다. 전체를 받을 때는 `from`이 root다.
 *
 * 조상을 따라 내려가며 짓는다. 겹치는 이름은 형제 안에서만 가른다 — 다른
 * 폴더에 든 같은 이름은 경로가 이미 다르므로 건드릴 이유가 없다.
 */
function folderPaths(
	folders: FolderEntry[],
	from: Path,
	prefix: string,
): Map<string, string> {
	const byPath = new Map<string, FolderEntry[]>();
	for (const folder of folders) {
		const siblings = byPath.get(folder.path) ?? [];
		siblings.push(folder);
		byPath.set(folder.path, siblings);
	}

	const resolved = new Map<string, string>();

	const walk = (parentPath: string, here: string) => {
		const siblings = [...(byPath.get(parentPath) ?? [])].sort(
			(a, b) => a.order - b.order,
		);
		const taken = new Set<string>();
		for (const folder of siblings) {
			const name = unique(taken, safeFileName(folder.name), "");
			const under = here ? `${here}/${name}` : name;
			resolved.set(folder.id, under);
			// 자식의 path는 이 폴더의 전체 경로다. 규칙은 entities가 들고 있다
			walk(fullPath(folder), under);
		}
	};

	walk(from, prefix);
	return resolved;
}

/**
 * 색인 하나를 zip 항목 목록으로.
 *
 * **휴지통은 담지 않는다.** 버린 것을 백업에 섞으면 받아 간 사람이 어느 것이
 * 살아 있는 원고인지 알 수 없다.
 *
 * 빈 폴더는 나오지 않는다 — zip에 빈 디렉터리를 넣어도 푸는 도구마다 다르게
 * 다루고, 원고가 없는 폴더를 굳이 옮길 이유도 없다.
 */
export function toZipEntries(
	index: StoreIndex,
	scope: ZipScope = WHOLE_ARCHIVE,
): ZipEntry[] {
	/*
	 * 어디서부터 훑는가. 폴더면 그 폴더의 전체 경로이고, 전체면 root다.
	 *
	 * root(`"/"`)는 모든 경로의 앞머리라 아래 `isUnder`가 전부를 통과시킨다 —
	 * 두 경우를 가르는 가지를 따로 둘 일이 없다.
	 */
	const from = scope.kind === "folder" ? fullPath(scope.folder) : ROOT;
	/** zip 안의 맨 위 칸. 전체를 받을 때는 없다 */
	const top = scope.kind === "folder" ? safeFileName(scope.folder.name) : "";

	const paths = folderPaths(index.folders, from, top);
	// 담는 폴더 자신은 walk가 지나지 않는다. 그 바로 아래 원고가 놓일 자리라 여기 적는다
	if (scope.kind === "folder") paths.set(scope.folder.id, top);

	const byPath = new Map<string, DocEntry[]>();
	for (const doc of index.docs) {
		if (!isUnder(doc.path, from)) continue;
		const siblings = byPath.get(doc.path) ?? [];
		siblings.push(doc);
		byPath.set(doc.path, siblings);
	}

	const entries: ZipEntry[] = [];
	for (const [path, docs] of byPath) {
		/*
		 * 원고가 놓인 폴더는 `path`의 **마지막 id**다. 그 폴더를 못 찾으면(색인이
		 * 어긋났거나 조상이 사라졌으면) 맨 위에 둔다 — 통째로 빠뜨리는 것보다 낫다.
		 */
		const parentId = path.split("/").filter(Boolean).pop();
		const holder = parentId ? paths.get(parentId) : undefined;
		const prefix = holder ?? top;

		const taken = new Set<string>();
		for (const doc of [...docs].sort((a, b) => a.order - b.order)) {
			const name = unique(taken, safeFileName(doc.title), ".txt");
			entries.push({
				path: prefix ? `${prefix}/${name}` : name,
				docId: doc.id,
				title: doc.title,
			});
		}
	}

	return entries;
}
