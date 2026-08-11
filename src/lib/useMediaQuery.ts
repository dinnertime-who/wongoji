import { useEffect, useState } from "react";

/**
 * 화면 조건이 맞는가.
 *
 * CSS로 가리는 것과 다르다. `hidden lg:block`은 보이지 않는 쪽도 그려 두고 눈에서만
 * 지운다. 단추 몇 개라면 그 편이 낫다 — 첫 그림에 바로 자리를 잡는다. 하지만
 * 보관함처럼 통째로 한 벌 더 그리게 되는 것은 아예 그리지 않는 편이 낫다.
 *
 * 서버에는 화면이 없어 false로 시작하고 마운트한 뒤에 맞춘다.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		const media = window.matchMedia(query);
		const sync = () => setMatches(media.matches);
		sync();
		media.addEventListener("change", sync);
		return () => media.removeEventListener("change", sync);
	}, [query]);

	return matches;
}

/** Tailwind의 `lg`. 이 위에서 원고와 원고지를 나란히 놓는다 */
export const LG = "(min-width: 64rem)";
