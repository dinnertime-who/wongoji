import { type Block, parseBlocks } from "./typesetting";

/**
 * 원고를 글자로 바꾸고 되돌린다.
 *
 * 부수효과가 없다 — 파일을 만들거나 내려받는 일은 그것을 쓰는 쪽(feature)이
 * 한다. 여기 있는 것은 "원고를 어떤 글자로 적는가"뿐이고, 그건 원고 자신이
 * 아는 일이다.
 */

export interface Manuscript {
	title: string;
	blocks: Block[];
}

/** 파일 이름으로 쓸 수 없는 글자를 걷어낸다 */
export function safeFileName(title: string): string {
	const trimmed = title
		.trim()
		.replace(/[\\/:*?"<>|]/g, "")
		.slice(0, 60);
	return trimmed || "원고";
}

/** 사람이 읽는 평문. 빈 행은 빈 줄로 나가지만 다시 읽어들이면 사라진다 */
export function toPlainText({ title, blocks }: Manuscript): string {
	const head = title.trim() ? [title.trim(), ""] : [];
	const body = blocks.map((b) => (b.type === "paragraph" ? b.text : ""));
	return [...head, ...body].join("\n").trim();
}

/**
 * 백업 파일에 담을 값. 되살릴 수 있는 완전한 사본이다.
 */
export const toBackup = (manuscript: Manuscript) => ({
	version: 1,
	...manuscript,
});

/**
 * 저장된 값이 정말 블록 배열인가.
 *
 * 파일에서 온 것은 무엇이든 들어올 수 있다. 검사하지 않고 통과시키면 조판
 * 도중에 터지는데, 그것은 렌더 중이라 화면 전체가 내려앉는다.
 */
function isBlock(value: unknown): value is Block {
	if (value == null || typeof value !== "object") return false;
	const b = value as { type?: unknown; text?: unknown };
	if (b.type === "blankRow") return true;
	return b.type === "paragraph" && typeof b.text === "string";
}

/**
 * 백업 파일이나 평문을 읽어 원고로 되돌린다.
 *
 * 확장자를 믿지 않고 내용으로 가른다 — 사용자가 파일 이름을 바꿔 두었을 수 있다.
 * 블록이 하나라도 성치 않으면 백업으로 보지 않고 평문으로 읽는다. 반쯤 살려서
 * 조용히 일부를 잃는 것보다, 통째로 글자로 읽어 눈에 보이게 하는 편이 낫다.
 */
export function parseImported(raw: string): Manuscript {
	try {
		const parsed = JSON.parse(raw);
		if (
			parsed &&
			Array.isArray(parsed.blocks) &&
			parsed.blocks.every(isBlock)
		) {
			return {
				title: typeof parsed.title === "string" ? parsed.title : "",
				blocks: parsed.blocks as Block[],
			};
		}
	} catch {
		// 평문이라는 뜻이다
	}
	return { title: "", blocks: parseBlocks(raw) };
}
