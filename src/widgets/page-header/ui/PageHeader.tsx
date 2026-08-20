import { AuthButton } from "#/features/auth";
import { Separator } from "#/shared/ui/separator";
import { SidebarTrigger } from "#/shared/ui/sidebar";

/**
 * 쪽의 머리말.
 *
 * 원고 쪽과 폴더 쪽이 함께 쓴다. 쪽을 옮겨도 같은 자리에 같은 크기로 있어야
 * 해서, 짜임이 조금이라도 갈리면 옮길 때마다 머리말이 덜컥거린다. 전에는 두
 * 쪽이 같은 클래스 문자열을 각자 적고 있었다.
 *
 * **여기 놓이는 것은 본문이 아니라 창틀이다.** 보관함 단추도, 지금 어디인지도,
 * 로그인도 어느 쪽을 보고 있든 같은 일을 한다. 그래서 본문 폭을 따라가지 않고
 * 머리말 양 끝에 붙는다 — 접는 단추는 접히는 것 옆에, 로그인은 오른쪽 끝에.
 *
 * 전에는 쪽마다 본문 폭(`max-w-3xl`·`max-w-6xl`)에 맞춰 가운데로 모아 두었다.
 * 넓은 화면에서 그것이 어색했다. 보관함 경계에서 한참 떨어진 허공에 접는 단추가
 * 떠 있고, 로그아웃은 창 오른쪽 끝이 아니라 목록 끝을 따라 안쪽에 서 있었다.
 * 머리말은 창에 걸린 띠인데 본문 칸처럼 굴었던 것이다.
 *
 * 높이는 `min-h-12`로 못박는다. 좁은 화면에서는 줄이 접혀 두 줄이 되지만, 접히지
 * 않는 동안에는 무엇이 들었든 같은 높이라 쪽을 옮겨도 아래 본문이 밀리지 않는다.
 */
export function PageHeader({
	sidebar = true,
	children,
	actions,
}: {
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
			<div className="flex min-h-12 w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:px-4">
				{/*
				 * 단추 하나로 족하다. 넓으면 옆의 보관함을 접었다 펴고, 좁으면
				 * 서랍을 연다 — 어느 쪽인지는 Sidebar가 안에서 가른다.
				 *
				 * 왼쪽으로 조금 당긴다. 유령 단추라 테두리가 없어, 글자와 같은
				 * 자리에서 시작하면 아이콘만 안쪽으로 들어가 보인다.
				 */}
				{sidebar && (
					<>
						<SidebarTrigger
							className="-ml-1"
							title="보관함"
							aria-label="보관함"
						/>
						{/*
						 * 창틀과 지금 자리를 가르는 금. 둘이 붙어 한 덩어리로 읽히지 않게.
						 *
						 * **`data-vertical:` 를 붙여야 가운데 선다.** 정본이 세로 금에
						 * `data-vertical:self-stretch`를 걸어 두는데, 맨 `self-center`는
						 * 변형이 붙은 그것과 다른 클래스라 tailwind-merge가 둘 다 남긴다.
						 * 그러면 높이가 못박힌 금이 줄 맨 위에 붙어 8px 떠 보인다.
						 */}
						<Separator
							orientation="vertical"
							className="mr-0.5 h-4 data-vertical:self-center"
						/>
					</>
				)}

				{children}

				<div className="ml-auto flex items-center gap-2 text-xs tabular-nums">
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
