import { createContext, useContext, useMemo } from "react";
import { authClient } from "./auth-client";

/**
 * 지금 로그인한 사람.
 *
 * **서버가 먼저 답한다.** better-auth의 브라우저 훅은 마운트한 뒤에야 세션을
 * 물으므로, 그것만 보고 있으면 첫 렌더에서는 늘 "모르겠다"가 된다. 그 "모르겠다"
 * 하나 때문에 이 앱의 첫 화면이 통째로 비어 있었다 — 어느 원고를 열지, 보관함을
 * 그릴지, 로그인 단추를 그릴지가 전부 그 답을 기다렸다.
 *
 * 서버는 쿠키를 들고 있으니 그릴 때 이미 안다. 그 답을 첫 HTML에 실어 보내고
 * (`routes/-boot.ts`), 여기서 받아 둔다. 그래서 **`isPending`이 없다** — 물어볼
 * 것이 없기 때문이다.
 *
 * 브라우저 훅을 버리지는 않는다. 로그아웃처럼 **그리는 도중에 바뀌는 일**은
 * 서버가 알 수 없고, 그때는 훅 쪽이 옳다. 훅이 답을 들고 있으면 그것을 쓰고,
 * 아직 묻는 중이면 서버가 준 것을 쓴다.
 */

export interface SessionUser {
	id: string;
	name: string;
	email: string;
	image: string | null;
}

/** 서버가 준 답. Provider 바깥에서 부르면 null이고, 그때는 훅만 본다 */
const Seeded = createContext<SessionUser | null>(null);

export function SessionProvider({
	user,
	children,
}: {
	user: SessionUser | null;
	children: React.ReactNode;
}) {
	return <Seeded.Provider value={user}>{children}</Seeded.Provider>;
}

export function useSessionUser(): SessionUser | null {
	const seeded = useContext(Seeded);
	const { data, isPending } = authClient.useSession();

	// 조각으로 받아 둔다. 객체째 의존성에 두면 훅이 매번 새로 지어 낸 것에 걸린다
	const id = data?.user?.id;
	const name = data?.user?.name;
	const email = data?.user?.email;
	const image = data?.user?.image;

	/*
	 * 같은 사람이면 같은 객체를 돌려준다. 렌더마다 새 객체를 내놓으면 이것을
	 * 의존성에 둔 effect가 그때마다 다시 돈다.
	 */
	return useMemo(() => {
		// 아직 묻는 중이면 서버가 준 답이 가장 새 것이다
		if (isPending) return seeded;
		if (!id) return null;
		return { id, name: name ?? "", email: email ?? "", image: image ?? null };
	}, [isPending, seeded, id, name, email, image]);
}

/** 이 사람의 id. 부르는 곳 대부분이 이것만 필요하다 */
export const useUserId = (): string | null => useSessionUser()?.id ?? null;
