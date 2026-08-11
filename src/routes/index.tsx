import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { bootstrap } from "#/lib/store/bootstrap";

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

	useEffect(() => {
		const opened = bootstrap();
		if (opened.docId) {
			navigate({
				to: "/w/$docId",
				params: { docId: opened.docId },
				replace: true,
			});
		}
	}, [navigate]);

	return null;
}
