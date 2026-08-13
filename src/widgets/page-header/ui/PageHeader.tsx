import { AuthButton } from "#/features/auth";
import { SidebarTrigger } from "#/shared/ui/sidebar";

/**
 * 쪽의 머리말.
 *
 * 원고 쪽과 폴더 쪽이 함께 쓴다. 쪽을 옮겨도 같은 자리에 같은 크기로 있어야
 * 해서, 짜임이 조금이라도 갈리면 옮길 때마다 머리말이 덜컥거린다. 전에는 두
 * 쪽이 같은 클래스 문자열을 각자 적고 있었다.
 *
 * 폭만 다르다 — 원고 쪽은 원고지를 나란히 두느라 넓고, 폴더 쪽은 읽는 목록이라
 * 좁다.
 */
export function PageHeader({
	width = "wide",
	sidebar = true,
	children,
	actions,
}: {
	width?: "wide" | "narrow";
	/**
	 * 보관함이 옆에 있는가.
	 *
	 * 비로그인 체험 원고에는 없다 — 접었다 펼 것이 없는데 단추를 두면 눌러도
	 * 아무 일이 없고, 무엇보다 `SidebarTrigger`는 보관함 바깥에서 살 수 없다.
	 */
	sidebar?: boolean;
	/** 지금 어디인지. 보통 브레드크럼이 온다 */
	children: React.ReactNode;
	/** 오른쪽에 붙는 것들. 로그인 단추 왼편에 온다 */
	actions?: React.ReactNode;
}) {
	return (
		<header className="sticky top-0 z-10 border-border border-b bg-background/90 backdrop-blur">
			<div
				className={`mx-auto flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${
					width === "wide" ? "max-w-6xl px-4" : "max-w-3xl px-6"
				}`}
			>
				{/*
				 * 단추 하나로 족하다. 넓으면 옆의 보관함을 접었다 펴고, 좁으면
				 * 서랍을 연다 — 어느 쪽인지는 Sidebar가 안에서 가른다.
				 */}
				{sidebar && <SidebarTrigger title="보관함" aria-label="보관함" />}

				{children}

				<div className="ml-auto flex items-center gap-3 text-xs tabular-nums">
					{actions}
					{/*
					 * 로그인은 맨 오른쪽 끝. 이제는 표시가 아니라 문이다 — 여러 편을
					 * 두고 폴더로 갈라 쓰는 일은 계정 쪽에 있다.
					 */}
					<AuthButton />
				</div>
			</div>
		</header>
	);
}
