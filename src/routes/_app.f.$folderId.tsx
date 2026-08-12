import { createFileRoute } from "@tanstack/react-router";
import { FolderPage } from "#/pages/folder";

export const Route = createFileRoute("/_app/f/$folderId")({
	component: Screen,
});

function Screen() {
	const { folderId } = Route.useParams();
	return <FolderPage folderId={folderId} />;
}
