import {
	type DocEntry,
	type FolderEntry,
	fullPath,
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
 * 조상을 따라 내려가며 짓는다. 겹치는 이름은 형제 안에서만 가른다 — 다른
 * 폴더에 든 같은 이름은 경로가 이미 다르므로 건드릴 이유가 없다.
 */
function folderPaths(folders: FolderEntry[]): Map<string, string> {
	const byPath = new Map<string, FolderEntry[]>();
	for (const folder of folders) {
		const siblings = byPath.get(folder.path) ?? [];
		siblings.push(folder);
		byPath.set(folder.path, siblings);
	}

	const resolved = new Map<string, string>();

	const walk = (parentPath: string, prefix: string) => {
		const siblings = [...(byPath.get(parentPath) ?? [])].sort(
			(a, b) => a.order - b.order,
		);
		const taken = new Set<string>();
		for (const folder of siblings) {
			const name = unique(taken, safeFileName(folder.name), "");
			const here = prefix ? `${prefix}/${name}` : name;
			resolved.set(folder.id, here);
			// 자식의 path는 이 폴더의 전체 경로다. 규칙은 entities가 들고 있다
			walk(fullPath(folder), here);
		}
	};

	walk(ROOT, "");
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
export function toZipEntries(index: StoreIndex): ZipEntry[] {
	const paths = folderPaths(index.folders);

	const byPath = new Map<string, DocEntry[]>();
	for (const doc of index.docs) {
		const siblings = byPath.get(doc.path) ?? [];
		siblings.push(doc);
		byPath.set(doc.path, siblings);
	}

	const entries: ZipEntry[] = [];
	for (const [path, docs] of byPath) {
		/*
		 * 원고가 놓인 폴더는 `path`의 **마지막 id**다. 그 폴더를 못 찾으면(색인이
		 * 어긋났거나 조상이 사라졌으면) 뿌리에 둔다 — 통째로 빠뜨리는 것보다 낫다.
		 */
		const parentId = path.split("/").filter(Boolean).pop();
		const prefix = parentId ? (paths.get(parentId) ?? "") : "";

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
