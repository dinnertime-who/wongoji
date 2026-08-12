import { createFileRoute } from "@tanstack/react-router";
import { EditorPage } from "#/pages/editor";

export const Route = createFileRoute("/_app/w/$docId")({ component: Screen });

function Screen() {
	const { docId } = Route.useParams();
	return <EditorPage docId={docId} />;
}
