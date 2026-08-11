import { useNavigate } from "@tanstack/react-router";
import { FilePlusIcon, FolderPlusIcon } from "lucide-react";
import { useState } from "react";
import { ManuscriptTree } from "#/components/ManuscriptTree";
import { NameDialog } from "#/components/NameDialog";
import { Button } from "#/components/ui/button";
import {
	ancestorIds,
	createDoc,
	createFolder,
	mutateIndex,
	type Path,
	ROOT,
	type SaveResult,
	type StoreIndex,
	writeDoc,
} from "#/lib/store";

/**
 * 원고 보관함.
 *
 * 새 원고와 새 폴더는 **지금 보고 있는 원고가 든 폴더**에 만든다. 맨 위에 있으면
 * root에 만든다. 어디에 생겼는지 헤매지 않게 하려는 것이다.
 */
export function ManuscriptSidebar({
	index,
	currentDocId,
	onReport,
	onNavigate,
	inDrawer = false,
}: {
	index: StoreIndex;
	currentDocId: string;
	onReport: (result: SaveResult) => void;
	onNavigate?: () => void;
	/** 좁은 화면의 서랍 안인가. 서랍은 오른쪽 위에 제 닫기 단추를 그린다 */
	inDrawer?: boolean;
}) {
	const navigate = useNavigate();
	const [naming, setNaming] = useState(false);
	const here = index.docs.find((d) => d.id === currentDocId)?.path ?? ROOT;

	const addDoc = (path: Path) => {
		let createdId = "";
		const { result } = mutateIndex((current) => {
			const made = createDoc(current, { path });
			createdId = made.doc.id;
			return made.index;
		});
		onReport(result);
		if (!result.ok) return;
		// 본문 자리를 비워 둔 채로 만든다 — 없으면 "본문을 찾을 수 없다"로 보인다
		writeDoc(createdId, { type: "doc", content: [{ type: "paragraph" }] });
		navigate({ to: "/w/$docId", params: { docId: createdId } });
		onNavigate?.();
	};

	const addFolder = (name: string) => {
		const { result } = mutateIndex(
			(current) => createFolder(current, name, here).index,
		);
		onReport(result);
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* 서랍의 닫기 X가 오른쪽 위에 겹쳐 앉는다. 그만큼 비켜 준다 */}
			<div
				className={`flex shrink-0 items-center gap-1 py-2 pl-2 ${
					inDrawer ? "pr-12" : "pr-2"
				}`}
			>
				<span className="flex-1 px-1 text-muted-foreground text-xs">원고</span>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setNaming(true)}
					title="새 폴더"
					aria-label="새 폴더"
				>
					<FolderPlusIcon />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => addDoc(here)}
					title="새 원고"
					aria-label="새 원고"
				>
					<FilePlusIcon />
				</Button>
			</div>

			{/*
			 * 가로·세로 모두 스크롤한다. 원고가 쌓이면 세로가, 트리가 깊어지면 가로가
			 * 필요하다. 이름을 자르는 것보다 미는 편이 낫다.
			 */}
			<nav
				className="min-h-0 flex-1 overflow-auto px-1"
				aria-label="원고 보관함"
			>
				<ManuscriptTree
					index={index}
					currentDocId={currentDocId}
					onAddDoc={addDoc}
					onNavigate={onNavigate}
				/>
			</nav>

			<NameDialog
				open={naming}
				onOpenChange={setNaming}
				title="새 폴더"
				description="지금 보고 있는 원고와 같은 자리에 만듭니다."
				initial="새 폴더"
				onConfirm={addFolder}
			/>
		</div>
	);
}

/** 헤더에 놓는 현재 위치. 사이드바를 접었을 때 유일한 단서다 */
export function ManuscriptBreadcrumb({
	index,
	docId,
}: {
	index: StoreIndex;
	docId: string;
}) {
	const doc = index.docs.find((d) => d.id === docId);
	if (!doc) return null;

	const byId = new Map(index.folders.map((f) => [f.id, f]));
	const names = ancestorIds(doc.path)
		.map((id) => byId.get(id)?.name)
		.filter((name): name is string => Boolean(name));

	// 길어지면 앞을 줄인다
	const shown = names.length > 2 ? ["…", ...names.slice(-2)] : names;

	return (
		<span className="min-w-0 truncate text-muted-foreground text-xs">
			{shown.map((name) => (
				<span key={name}>{name} / </span>
			))}
			<span className="text-foreground">
				{doc.title.trim() || "제목 없는 원고"}
			</span>
		</span>
	);
}
