import * as React from "react";

/*
 * Tailwind의 `lg`. shadcn 기본값은 768이지만 이 앱은 1024를 경계로 삼는다 —
 * 이 아래에서는 원고에 자리를 내줄 수 없어 보관함을 서랍으로 뺀다.
 */
const MOBILE_BREAKPOINT = 1024;

export function useIsMobile() {
	const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
		undefined,
	);

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const onChange = () => {
			setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		};
		mql.addEventListener("change", onChange);
		setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	return !!isMobile;
}
