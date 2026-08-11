import { useEffect, useState } from "react";

/**
 * 미디어 쿼리 일치 여부.
 *
 * CSS로 숨기는 대신 자바스크립트로 갈라야 하는 곳에 쓴다. 에디터를 데스크톱용과
 * 모바일용에 각각 두면 Tiptap 인스턴스가 둘이 되어 내용이 갈라지므로,
 * 한쪽만 렌더해야 한다.
 *
 * 서버에서는 `defaultValue`로 렌더하고 마운트 후 실제 값으로 맞춘다.
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
	const [matches, setMatches] = useState(defaultValue);

	useEffect(() => {
		const mq = window.matchMedia(query);
		const update = () => setMatches(mq.matches);
		update();
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	}, [query]);

	return matches;
}
