import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileTextIcon, FolderIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { CapacityMeter } from "#/components/CapacityMeter";
import { PageTitle } from "#/components/PageTitle";
import { SaveErrorBanner } from "#/components/SaveErrorBanner";
import { Shell } from "#/components/Shell";
import { Button } from "#/components/ui/button";
import { SidebarTrigger } from "#/components/ui/sidebar";
import {
	childrenOf,
	createDoc,
	createFolder,
	type DocEntry,
	displayTitle,
	type FolderEntry,
	fullPath,
	mutateIndex,
	pathNames,
	readIndex,
	renameFolder,
	type SaveFailure,
	tidy,
	updateDoc,
	useStoreIndex,
	writeDoc,
} from "#/lib/store";

export const Route = createFileRoute("/f/$folderId")({ component: FolderPage });

/** 새 원고의 빈 본문. ManuscriptSidebar와 같은 값이다 */
const EMPTY_BODY = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * 폴더 안을 펼쳐 보이는 쪽.
 *
 * 보관함의 트리와 같은 것을 담지만 쓰임이 다르다. 트리는 원고를 쓰는 동안 옆에
 * 두고 곁눈질하는 것이고, 이 쪽은 무엇이 들어 있는지 한 번에 보려고 여는 것이다.
 */
function FolderPage() {
	const { folderId } = Route.useParams();
	const navigate = useNavigate();
	const index = useStoreIndex();
	const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);

	const folder = index.folders.find((f) => f.id === folderId);

	// 기한 지난 휴지통 비우기·끊어진 경로 고치기. 여기로 바로 들어올 수도 있다
	useEffect(() => {
		tidy();
	}, []);

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
	const trail = pathNames(folder.path, index.folders);

	const change = (edit: Parameters<typeof mutateIndex>[0]) => {
		const { result } = mutateIndex(edit);
		setSaveFailure(result.ok ? null : result);
	};

	const rename = (name: string) =>
		change((current) => renameFolder(current, folder.id, name));

	const addDoc = () => {
		let createdId = "";
		change((current) => {
			const made = createDoc(current, { path: inside });
			createdId = made.doc.id;
			return made.index;
		});
		if (!createdId) return;
		writeDoc(createdId, EMPTY_BODY);
		navigate({ to: "/w/$docId", params: { docId: createdId } });
	};

	const addFolder = () =>
		change((current) => createFolder(current, "새 폴더", inside).index);

	const empty = folders.length === 0 && docs.length === 0;

	/*
	 * 하나뿐인 원고를 비운다.
	 *
	 * 여기서는 저장소만 고치면 된다. 원고 쪽과 달리 에디터가 떠 있지 않아, 갈아
	 * 끼운 내용을 곧바로 되덮을 것이 없다.
	 */
	const resetOnlyDoc = () => {
		const only = readIndex().docs[0];
		if (!only) return;
		writeDoc(only.id, EMPTY_BODY);
		change((current) =>
			updateDoc(current, only.id, { title: "", goal: 0, chars: 0, sheets: 1 }),
		);
	};

	return (
		<Shell
			index={index}
			currentDocId=""
			onReport={(result) => setSaveFailure(result.ok ? null : result)}
			onReset={resetOnlyDoc}
		>
			<header className="sticky top-0 z-10 border-border border-b bg-background/90 backdrop-blur">
				<div className="mx-auto flex max-w-3xl items-center gap-x-3 px-6 py-2.5">
					<SidebarTrigger title="보관함" aria-label="보관함" />
					<CapacityMeter index={index} />
				</div>
			</header>

			{saveFailure && <SaveErrorBanner failure={saveFailure} />}

			<div className="mx-auto w-full max-w-3xl overflow-auto px-6 py-10">
				{/* 어디에 있는 폴더인지. 이름만으로는 같은 이름이 여럿일 때 가려지지 않는다 */}
				{trail.length > 0 && (
					<p className="mb-2 truncate text-muted-foreground text-xs">
						{trail.join(" / ")}
					</p>
				)}

				<PageTitle
					value={folder.name}
					onChange={rename}
					placeholder="이름 없는 폴더"
					label="폴더 이름"
				/>

				<div className="mt-6 flex flex-col">
					{folders.map((child) => (
						<PageLink key={child.id} folder={child} />
					))}
					{docs.map((doc) => (
						<PageLink key={doc.id} doc={doc} />
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
		</Shell>
	);
}

/**
 * 안에 든 것 하나. 폴더면 그 폴더 쪽으로, 원고면 원고로 간다.
 *
 * 분량은 원고에만 적는다. 폴더의 분량을 더해 보여 주려면 아래를 모두 훑어야
 * 하는데, 목록을 그릴 때마다 치를 값은 아니다.
 */
function PageLink({ folder, doc }: { folder?: FolderEntry; doc?: DocEntry }) {
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
