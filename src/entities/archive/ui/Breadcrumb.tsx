import { Link } from "@tanstack/react-router";
import { ancestorIds } from "../lib/path";
import type { FolderEntry, Path, StoreIndex } from "../model/types";

/** 이보다 깊어지면 앞을 줄인다. 머리말은 한 줄로 남아야 한다 */
const SHOWN = 2;

/**
 * 머리말에 놓는 현재 위치.
 *
 * 보관함을 접었을 때 여기가 어디인지 알려 주는 유일한 단서다. 조상 폴더는
 * 링크라 눌러서 거슬러 올라갈 수 있고, 맨 끝은 지금 보고 있는 것이라 링크가
 * 아니다 — 제자리로 가는 링크는 누를 이유가 없다.
 */
export function Breadcrumb({
	index,
	path,
	leaf,
}: {
	index: StoreIndex;
	/** 지금 보고 있는 것이 놓인 자리. 제 id는 들어가지 않는다 */
	path: Path;
	/** 맨 끝에 적을 이름 */
	leaf: string;
}) {
	const byId = new Map(index.folders.map((f) => [f.id, f]));
	const trail = ancestorIds(path)
		.map((id) => byId.get(id))
		.filter((folder): folder is FolderEntry => Boolean(folder));

	const shown = trail.slice(-SHOWN);
	const clipped = trail.length > shown.length;

	return (
		<span className="min-w-0 truncate text-muted-foreground text-xs">
			{/* 줄인 자리는 링크로 두지 않는다. 어느 폴더를 가리키는지 알 수 없다 */}
			{clipped && <span>… / </span>}
			{shown.map((folder) => (
				<span key={folder.id}>
					<Link
						to="/f/$folderId"
						params={{ folderId: folder.id }}
						className="rounded hover:text-foreground hover:underline"
					>
						{folder.name}
					</Link>
					{" / "}
				</span>
			))}
			<span className="text-foreground">{leaf}</span>
		</span>
	);
}
