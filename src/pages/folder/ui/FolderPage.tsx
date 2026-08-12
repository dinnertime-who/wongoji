import { Link, useNavigate } from "@tanstack/react-router";
import { FileTextIcon, FolderIcon } from "lucide-react";
import { useEffect } from "react";
import {
	Breadcrumb,
	childrenOf,
	createFolder,
	type DocEntry,
	displayTitle,
	type FolderEntry,
	fullPath,
	readIndex,
	renameFolder,
	useArchiveMutation,
	useSaveStatus,
	useStoreIndex,
} from "#/entities/archive";
import { createDocIn } from "#/features/create-entry";
import { Button } from "#/shared/ui/button";
import { PageTitle } from "#/shared/ui/page-title";
import { PageHeader } from "#/widgets/page-header";

/**
 * 폴더 안을 펼쳐 보이는 쪽.
 *
 * 보관함의 트리와 같은 것을 담지만 쓰임이 다르다. 트리는 원고를 쓰는 동안 옆에
 * 두고 곁눈질하는 것이고, 이 쪽은 무엇이 들어 있는지 한 번에 보려고 여는 것이다.
 */
export function FolderPage({ folderId }: { folderId: string }) {
	const navigate = useNavigate();
	const index = useStoreIndex();
	const { report } = useSaveStatus();
	const change = useArchiveMutation();

	const folder = index.folders.find((f) => f.id === folderId);

	/*
	 * 없는 폴더를 가리키는 주소면 열 수 있는 곳으로 보낸다. 휴지통에 넣었거나
	 * 다른 창에서 지운 것이다.
	 *
	 * 구독한 색인이 아니라 저장소를 그때그때 읽는다. 구독한 쪽은 마운트 뒤에야
	 * 채워져서, 첫 그림에서는 무엇을 찾아도 없다고 나온다 — 그대로 믿으면 멀쩡한
	 * 폴더를 열 때마다 되돌려 보낸다.
	 *
	 * index를 의존값에 두어 보고 있는 폴더가 사라지는 것도 잡는다.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: index는 다시 볼 때를 알리는 신호로만 둔다
	useEffect(() => {
		if (!readIndex().folders.some((f) => f.id === folderId)) {
			navigate({ to: "/", replace: true });
		}
	}, [folderId, index, navigate]);

	if (!folder) return null;

	const inside = fullPath(folder);
	const { folders, docs } = childrenOf(index, inside);

	const rename = (name: string) =>
		change((current) => renameFolder(current, folder.id, name));

	const addDoc = () => {
		const { docId, result } = createDocIn(inside);
		report(result);
		// 만들지 못했으면 옮기지 않는다. 없는 원고로 보내면 곧바로 되돌아온다
		if (docId) navigate({ to: "/w/$docId", params: { docId } });
	};

	const addFolder = () =>
		change((current) => createFolder(current, "새 폴더", inside).index);

	const empty = folders.length === 0 && docs.length === 0;

	return (
		<>
			<PageHeader width="narrow">
				<Breadcrumb path={folder.path} leaf={folder.name} />
			</PageHeader>

			<div className="mx-auto w-full max-w-3xl overflow-auto px-6 py-10">
				<PageTitle
					value={folder.name}
					onChange={rename}
					placeholder="이름 없는 폴더"
					label="폴더 이름"
				/>

				<div className="mt-6 flex flex-col">
					{folders.map((child) => (
						<EntryLink key={child.id} folder={child} />
					))}
					{docs.map((doc) => (
						<EntryLink key={doc.id} doc={doc} />
					))}

					{empty && (
						<p className="py-3 text-muted-foreground text-sm">
							아직 비어 있습니다.
						</p>
					)}
				</div>

				<div className="mt-4 flex gap-2">
					<Button variant="outline" size="sm" onClick={addDoc}>
						새 원고
					</Button>
					<Button variant="outline" size="sm" onClick={addFolder}>
						새 폴더
					</Button>
				</div>
			</div>
		</>
	);
}

/**
 * 안에 든 것 하나. 폴더면 그 폴더 쪽으로, 원고면 원고로 간다.
 *
 * 분량은 원고에만 적는다. 폴더의 분량을 더해 보여 주려면 아래를 모두 훑어야
 * 하는데, 목록을 그릴 때마다 치를 값은 아니다.
 */
function EntryLink({ folder, doc }: { folder?: FolderEntry; doc?: DocEntry }) {
	const shared =
		"flex items-center gap-2 rounded-md px-2 py-2 text-base hover:bg-muted";

	if (folder) {
		return (
			<Link
				to="/f/$folderId"
				params={{ folderId: folder.id }}
				className={shared}
			>
				<FolderIcon className="size-4 shrink-0 text-muted-foreground" />
				<span className="truncate">{folder.name}</span>
			</Link>
		);
	}
	if (!doc) return null;

	return (
		<Link to="/w/$docId" params={{ docId: doc.id }} className={shared}>
			<FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
			<span className="truncate">{displayTitle(doc)}</span>
			<span className="ml-auto shrink-0 text-muted-foreground text-xs tabular-nums">
				{doc.sheets}매
			</span>
		</Link>
	);
}
