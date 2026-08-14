import { LogIn, LogOut } from "lucide-react";
import { Button } from "#/shared/ui/button";
import {
	signInWithGoogle,
	signOut,
	useSessionUser,
} from "../model/use-session";

/**
 * 로그인 상태를 그대로 비추는 단추 하나.
 *
 * 들어오는 길이 구글뿐이라 제공자를 고르는 화면을 두지 않았다. 길이 늘면
 * 그때 고르는 화면이 필요하지, 지금 두면 한 칸짜리 목록이 된다.
 *
 * 전에는 여기에 `mounted` 게이트가 있었다. 세션이 브라우저에만 있어서 서버와
 * 첫 클라이언트 렌더가 어긋났고, 그것을 맞추려고 **양쪽 다 자리표시자를 그리게**
 * 해 두었다. 이제 서버가 첫 HTML에 사람을 실어 보내므로 어긋날 것이 없다 —
 * 서버가 그린 것과 브라우저가 그리는 첫 그림이 같다.
 */
export function AuthButton() {
	const user = useSessionUser();

	if (!user) {
		return (
			<Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>
				<LogIn data-icon="inline-start" />
				구글로 로그인
			</Button>
		);
	}

	return (
		<div className="flex min-w-0 items-center gap-2">
			{/*
			 * 이름이 없으면 이메일이 대신 온다. 이메일에는 공백이 없어 줄바꿈도
			 * 안 되므로, 자르지 않으면 머리말이 통째로 두 줄로 부푼다.
			 */}
			<span className="max-w-40 truncate text-muted-foreground text-xs">
				{user.name || user.email}
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
