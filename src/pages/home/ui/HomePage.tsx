import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ROOT, readLastOpened, useArchive } from "#/entities/archive";
import { useCreateEntry } from "#/features/create-entry";

/**
 * 마지막으로 열었던 원고로 보낸다.
 *
 * 어느 원고를 열지는 이 브라우저에만 있어서 서버가 알 수 없다. 그래서 서버에서
 * 주소를 정하지 못하고 여기서 옮긴다. 보관함이 비어 있으면 원고 하나를 만든다 —
 * 아무것도 없는 화면으로 시작하지 않는다.
 */
export function HomePage() {
	const navigate = useNavigate();
	const { index, isPending } = useArchive();
	const { createDocIn } = useCreateEntry();

	/*
	 * 만드는 중인가.
	 *
	 * 만들기는 서버를 다녀오는 일이라, 그 사이에 이 effect가 한 번 더 돌면(개발
	 * 모드의 두 번 실행, 색인이 도착할 때) 빈 원고가 둘 생긴다.
	 */
	const making = useRef(false);

	useEffect(() => {
		/*
		 * 아직 목록을 모르면 아무것도 하지 않는다. **비어 있는 것과 못 받은 것을
		 * 구별하지 않으면** 새로고침할 때마다 빈 원고가 하나씩 늘어난다.
		 */
		if (isPending) return;

		const last = readLastOpened();
		const target =
			last && index.docs.some((d) => d.id === last)
				? last
				: [...index.docs].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id;

		if (target) {
			navigate({ to: "/w/$docId", params: { docId: target }, replace: true });
			return;
		}

		if (making.current) return;
		making.current = true;

		void createDocIn(ROOT).then(({ docId }) => {
			// 못 만들었으면 다시 해 볼 수 있게 열어 둔다. 실패는 배너가 받는다
			if (!docId) {
				making.current = false;
				return;
			}
			navigate({ to: "/w/$docId", params: { docId }, replace: true });
		});
	}, [index, isPending, navigate, createDocIn]);

	return null;
}
