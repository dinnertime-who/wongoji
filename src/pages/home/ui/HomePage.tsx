import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { bootstrap } from "#/features/archive-bootstrap";
import { type SaveFailure, useScopeSettled } from "#/shared/lib/storage";
import { SaveErrorBanner } from "#/shared/ui/save-error-banner";

/**
 * 마지막으로 열었던 원고로 보낸다.
 *
 * 어느 원고를 열지는 localStorage에 있어서 서버가 알 수 없다. 그래서 서버에서
 * 주소를 정하지 못하고 브라우저에서 옮긴다. 보관함이 비어 있으면 bootstrap이
 * 원고 하나를 만들어 준다.
 */
export function HomePage() {
	const navigate = useNavigate();
	const [failure, setFailure] = useState<SaveFailure | null>(null);
	/*
	 * 어느 보관함인지 정해지기를 기다린다.
	 *
	 * 세션은 물어봐야 알고, 그 전까지 저장소는 지난번 칸을 쓴다. 로그인해서 막
	 * 돌아온 사람에게는 그것이 틀린 칸이라, 여기서 원고를 만들면 비로그인 칸에
	 * 빈 원고가 생긴다. 그 뒤 칸이 옮겨지면 방금 연 원고를 찾지 못해 이리로
	 * 되돌아오고, 또 만들고 — 화면이 그 왕복만 돈다.
	 */
	const settled = useScopeSettled();

	useEffect(() => {
		if (!settled) return;
		// 본문이 IndexedDB로 가면서 보관함을 세우는 일이 비동기가 되었다.
		// 그새 사용자가 다른 곳으로 갔으면 옮기지 않는다.
		let cancelled = false;

		bootstrap().then((opened) => {
			if (cancelled) return;

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
		});

		return () => {
			cancelled = true;
		};
	}, [navigate, settled]);

	if (!failure) return null;
	return <SaveErrorBanner failure={failure} />;
}
