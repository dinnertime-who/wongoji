import { useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Outlet,
	useLoaderData,
	useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { ARCHIVE_KEY, useSaveStatus } from "#/entities/archive";
import { drainOutbox, setDocOwner } from "#/entities/manuscript";
import { useUserId } from "#/features/auth";
import { liftAccountBodies } from "#/features/import-legacy";
import { requestPersistentStorage } from "#/shared/lib/storage";
import { SaveErrorBanner } from "#/shared/ui/save-error-banner";
import { AppShell } from "#/widgets/app-shell";
import { ManuscriptSidebar } from "#/widgets/manuscript-sidebar";
import { loadArchive } from "./-boot";

export const Route = createFileRoute("/_app")({
	/**
	 * 색인을 **화면보다 먼저** 받아 둔다.
	 *
	 * 전에는 보관함이 마운트된 뒤에야 `GET /api/archive`가 나갔다. 그 요청은 JS를
	 * 다 받고 하이드레이션이 끝난 다음에야 시작하므로, 사이드바는 그때까지 빈
	 * 채로 있었다. 서버에서 채워 두면 첫 HTML에 이미 목록이 그려져 나간다.
	 *
	 * 캐시에 넣는 것이 요점이다 — 화면은 지금처럼 `useArchive()`로 읽고, 그것이
	 * 여기서 채운 것을 그대로 집는다(`staleTime: Infinity`라 다시 묻지 않는다).
	 */
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData({
			queryKey: ARCHIVE_KEY,
			queryFn: loadArchive,
		});
	},
	/**
	 * **계정 쪽은 색인하지 않는다.**
	 *
	 * 로그인하지 않은 크롤러에게 `/w/<id>`는 남의 원고가 아니라 빈 껍데기다.
	 * 막지 않으면 제목이 똑같은 빈 쪽 수십 개가 색인되어, 정작 보여야 할 홈이
	 * 그 사이에 묻힌다.
	 *
	 * robots.txt로 막지 않는 이유는 반대다 — 거기서 막으면 크롤러가 이 문서를
	 * 아예 못 읽어서 이 `noindex`도 못 본다. 주소만 어디선가 주워 색인해 버릴
	 * 수 있다. **읽게 두고, 읽은 자리에서 빼라고 말한다.**
	 *
	 * 제목도 여기서 짧은 것으로 덮는다. 검색용 제목은 키워드를 담느라 길어서,
	 * 원고를 쓰는 내내 띄워 두는 탭에는 맞지 않는다.
	 */
	head: () => ({
		meta: [
			{ title: "원고지" },
			{ name: "robots", content: "noindex, nofollow" },
		],
	}),
	component: AppLayout,
});

/**
 * 보관함을 옆에 둔 쪽들이 함께 쓰는 껍데기.
 *
 * 주소에 나타나지 않는 레이아웃이다(`_app`). 원고 쪽과 폴더 쪽이 이 안에서
 * 갈리므로 **틀은 다시 마운트되지 않는다.**
 *
 * 전에는 각 쪽이 제 안에서 틀을 세웠다. 그래서 `/w/x`에서 `/f/y`로 옮기면 틀이
 * 통째로 갈리고, 보관함의 접힘 상태와 펼쳐 둔 폴더가 매번 초기화됐다 —
 * "어느 쪽을 보고 있든 보관함은 같은 자리에 같은 상태로 있어야 한다"고 적어
 * 두고서 그러지 못했다.
 */
function AppLayout() {
	// 보관함을 어떻게 두었는지는 서버가 쿠키에서 읽어 두었다
	const { panel } = useLoaderData({ from: "__root__" });

	return (
		<AppShell panel={panel} sidebar={<ManuscriptSidebar />}>
			<Chrome />
		</AppShell>
	);
}

function Chrome() {
	const navigate = useNavigate();
	const client = useQueryClient();
	const { failure, backup } = useSaveStatus();
	const userId = useUserId();

	/*
	 * 보관함은 계정 기능이다. 로그인하지 않았으면 볼 것이 없으므로 체험 원고로
	 * 돌려보낸다 — 로그아웃했을 때도 여기를 지난다.
	 *
	 * 전에는 "세션을 묻는 동안"을 기다려야 했다. 그 전에 내보내면 새로고침할 때마다
	 * 로그인한 사람이 제 보관함에서 튕겨 나갔기 때문이다. 이제 누구인지는 첫
	 * 렌더부터 확정이라 기다릴 국면이 없다.
	 */
	useEffect(() => {
		if (userId) return;
		navigate({ to: "/", replace: true });
	}, [userId, navigate]);

	/*
	 * 못 보낸 본문을 다시 보낸다.
	 *
	 * 전에는 이 자리에서 보관함을 다듬었다 — 기한 지난 휴지통 비우기, 끊어진 경로
	 * 고치기, 고아 본문 지우기. 셋 다 색인이 브라우저에 있을 때 필요했던 일이고,
	 * 지금은 서버가 제 것을 스스로 건사한다.
	 *
	 * 남은 것은 반대 방향 하나다. 저장이 실패한 채로 창을 닫았을 수 있으므로,
	 * 열 때 한 번 훑고 연결이 돌아올 때 다시 훑는다.
	 */
	useEffect(() => {
		setDocOwner(userId);
		if (!userId) return;

		// 아래 올리기와 **나란히 간다.** 기다리면 둘이 줄을 서고 첫 화면이 그만큼 늦다
		drainOutbox();
		/*
		 * 서버가 정본이 되기 전에 이 브라우저에만 남은 본문을 마저 올린다.
		 * 색인은 서버에 있는데 본문이 404인 원고가 실제로 있었다 — 그 사람에게는
		 * 원고가 통째로 사라진 것으로 보인다.
		 */
		liftAccountBodies(userId).then((lifted) => {
			/*
			 * 올린 뒤에는 다시 읽게 한다. 캐시는 스스로 낡지 않으므로
			 * (`staleTime: Infinity`), 방금 채운 본문이 있어도 화면은 먼저 읽어 둔
			 * "없음"에 머문다.
			 */
			if (lifted) client.invalidateQueries({ queryKey: ["doc"] });
		});

		const retry = () => drainOutbox();
		window.addEventListener("online", retry);
		return () => window.removeEventListener("online", retry);
	}, [userId, client]);

	useEffect(() => {
		// 용량이 부족할 때 브라우저가 미전송 본문을 먼저 지우지 않게 요청한다.
		// 거절되어도 알리지 않는다 — 사용자가 할 수 있는 조치가 없다.
		requestPersistentStorage();
	}, []);

	return (
		<>
			{failure && (
				<SaveErrorBanner failure={failure} onBackup={backup ?? undefined} />
			)}
			<Outlet />
		</>
	);
}
