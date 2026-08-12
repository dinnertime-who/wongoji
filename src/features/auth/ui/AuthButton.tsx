import { LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/shared/ui/button";
import { signInWithGoogle, signOut, useSession } from "../model/use-session";

/**
 * 로그인 상태를 그대로 비추는 단추 하나.
 *
 * 들어오는 길이 구글뿐이라 제공자를 고르는 화면을 두지 않았다. 길이 늘면
 * 그때 고르는 화면이 필요하지, 지금 두면 한 칸짜리 목록이 된다.
 */
export function AuthButton() {
	const { data: session, isPending } = useSession();

	/*
	 * 서버가 그린 것과 첫 클라이언트 렌더가 같아야 한다.
	 *
	 * 세션은 브라우저에만 있어서 `isPending`이 양쪽에서 다르게 나온다. 그대로 두면
	 * 서버는 자리표시자를, 클라이언트는 단추를 그려 하이드레이션이 깨지고 React가
	 * 이 가지를 통째로 다시 그린다.
	 */
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	// 세션을 물어보는 동안. 자리를 잡아 두지 않으면 단추가 튄다.
	if (!mounted || isPending) {
		return <div className="h-8 w-24" aria-hidden />;
	}

	if (!session) {
		return (
			<Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>
				<LogIn data-icon="inline-start" />
				구글로 로그인
			</Button>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<span className="text-muted-foreground text-xs">
				{session.user.name || session.user.email}
			</span>
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={() => signOut()}
				aria-label="로그아웃"
			>
				<LogOut />
			</Button>
		</div>
	);
}
