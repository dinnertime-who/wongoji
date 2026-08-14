import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ROOT } from "#/entities/archive";
import { useCreateEntry } from "#/features/create-entry";

/**
 * 보관함이 빈 사람에게 원고 하나를 만들어 준다.
 *
 * **여기 오는 사람은 이제 그 경우뿐이다.** 전에는 이 쪽이 "마지막으로 열었던
 * 원고로 보내는" 일도 맡았는데, 어느 원고인지가 이 브라우저의 localStorage에만
 * 있어서 서버가 정하지 못했기 때문이다. 그 값을 쿠키로 옮기면서 판단이
 * 라우트(`routes/index.tsx`)의 서버 쪽으로 올라갔고, 로그인한 사람은 첫 응답에서
 * 곧바로 제 원고로 간다.
 *
 * 아무것도 없는 화면으로 시작하지 않는다는 규칙만 여기 남았다.
 */
export function HomePage() {
	const navigate = useNavigate();
	const { createDocIn } = useCreateEntry();

	/*
	 * 만드는 중인가.
	 *
	 * 만들기는 서버를 다녀오는 일이라, 그 사이에 이 effect가 한 번 더 돌면(개발
	 * 모드의 두 번 실행) 빈 원고가 둘 생긴다.
	 */
	const making = useRef(false);

	useEffect(() => {
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
	}, [navigate, createDocIn]);

	return null;
}
