import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "#/features/auth";
import { LegacyNotice } from "#/features/import-legacy";
import { EditorPage } from "#/pages/editor";
import { HomePage } from "#/pages/home";

export const Route = createFileRoute("/")({ component: Screen });

/**
 * 로그인 여부로 갈리는 유일한 자리.
 *
 * - **비로그인** — 원고 한 편을 그대로 연다. 보관함도 사이드바도 없다. 원고지가
 *   어떻게 조판되는지 보러 온 사람이 계정부터 만들 이유가 없다
 * - **로그인** — 마지막으로 보던 원고로 보낸다. 그쪽에 보관함이 있다
 *
 * 갈림을 라우트에 둔 이유는 쪽(page)끼리 서로를 부를 수 없기 때문이다. 주소를
 * 아는 자리가 여기뿐이라 고르는 일도 여기 있다.
 */
function Screen() {
	const { data: session, isPending } = useSession();

	/*
	 * 세션이 도착할 때까지 기다린다. 그 전에 체험 원고를 그리면, 로그인한 사람이
	 * 제 원고 대신 빈 원고를 잠깐 보고 그 사이에 타이핑한 것이 엉뚱한 곳에 남는다.
	 */
	if (isPending) return null;

	if (session) return <HomePage />;

	return (
		<>
			{/* 옛 원고가 남아 있으면 알린다. 없으면 아무것도 그리지 않는다 */}
			<LegacyNotice />
			<EditorPage docId={null} />
		</>
	);
}
