import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { bootstrap } from "#/features/archive-bootstrap";
import type { SaveFailure } from "#/shared/lib/storage";
import { SaveErrorBanner } from "#/shared/ui/save-error-banner";

export const Route = createFileRoute("/")({ component: Landing });

/**
 * 마지막으로 열었던 원고로 보낸다.
 *
 * 어느 원고를 열지는 localStorage에 있어서 서버가 알 수 없다. 그래서 서버에서
 * 주소를 정하지 못하고 브라우저에서 옮긴다. 보관함이 비어 있으면 bootstrap이
 * 원고 하나를 만들어 준다.
 */
function Landing() {
	const navigate = useNavigate();
	const [failure, setFailure] = useState<SaveFailure | null>(null);

	useEffect(() => {
		const opened = bootstrap();

		/*
		 * 열 원고를 못 정했으면 옮기지 않는다.
		 *
		 * 옛 코드는 실패를 버리고 docId만 봤다. 저장소를 아예 쓸 수 없을 때 그러면
		 * 여기서 /w/<id>로 보내고, 그쪽은 색인에서 그 원고를 못 찾아 다시 여기로
		 * 보낸다 — 화면이 빈 채로 그 왕복만 돈다. 멈추고 이유를 적는다.
		 */
		if (!opened.result.ok) {
			setFailure(opened.result);
			return;
		}
		if (!opened.docId) return;

		navigate({
			to: "/w/$docId",
			params: { docId: opened.docId },
			replace: true,
		});
	}, [navigate]);

	if (!failure) return null;
	return <SaveErrorBanner failure={failure} />;
}
