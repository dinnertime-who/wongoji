import type { DropZone } from "../lib/drop-zone";

/**
 * 끼울 자리를 알리는 선.
 *
 * **들여쓰기를 목적지 깊이에 맞춘다.** 이것이 없으면 펴 둔 폴더의 아래 끝에
 * 그은 선과 그 첫 자식 위에 그은 선을 눈으로 가릴 수 없다 — 화면에서 두 선은
 * 같은 자리에 놓인다. 어느 층으로 들어가는지는 왼쪽 끝이 어디서 시작하느냐가
 * 말해 준다.
 *
 * 줄 밖으로 반 픽셀 넘겨 그린다. 줄과 줄 사이에 놓여야 "사이에 낀다"로 읽힌다.
 */
export function DropLine({
	zone,
	indent,
}: {
	zone: Exclude<DropZone, "into">;
	/** 목적지 층의 들여쓰기. 줄에 준 padding-left와 같은 값 */
	indent: string;
}) {
	return (
		<div
			aria-hidden
			className={`pointer-events-none absolute right-0 z-10 h-0.5 rounded-full bg-ring ${
				zone === "before" ? "-top-px" : "-bottom-px"
			}`}
			style={{ left: indent }}
		/>
	);
}
