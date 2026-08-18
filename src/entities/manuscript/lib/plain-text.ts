import type { Content } from "@tiptap/react";
import { BLANK_ROW_TYPE } from "./tiptap";

/**
 * 원고를 **있는 그대로** 평문으로 옮긴다.
 *
 * 조판 블록(`Block[]`)이 아니라 **에디터 문서 원본**을 읽는 것이 요점이다.
 * `blocksFromDoc`이 빈 문단을 버리기 때문에, 블록을 거쳐 온 글에는 사람이 엔터를
 * 몇 번 쳤는지가 이미 남아 있지 않다. 원고지 위에서는 그것이 옳다 — 문단은
 * 들여쓰기로 표시하지 빈 줄로 표시하지 않으므로 빈 문단이 칸을 차지해서는 안
 * 된다. 하지만 **원고를 글자로 내보낼 때는 그 여백이 글의 일부다.**
 *
 * 그래서 여기서는 셋을 모두 한 줄로 낸다.
 *
 * - 글이 있는 문단 → 그 글
 * - **빈 문단**(엔터를 두 번 이상 친 자리) → 빈 줄
 * - **빈 행**(`Ctrl+Enter`, 운문의 연 사이) → 빈 줄
 *
 * 빈 줄을 **하나로 합치지 않는다.** 다섯 번 띄운 자리는 다섯 줄로 나간다. 여백의
 * 크기가 곧 뜻인 글(운문·장면 전환)이 있고, 받아 간 글을 읽는 것은 사람이거나
 * 기계인데 둘 다 원문을 그대로 본다. 앱이 "이만하면 한 줄이면 족하다"고 정하기
 * 시작하면 어디까지가 글쓴이의 뜻인지 앱이 대신 판단하는 것이 된다.
 *
 * **markdown이 아니라 평문인 이유도 이것이다.** markdown은 연속된 빈 줄을 문단
 * 구분 하나로 정규화한다 — 그것이 markdown이 하는 일이라, 여백을 세는 글과는
 * 애초에 맞지 않는다.
 *
 * 빈 행과 빈 문단을 가르지 않는다. 둘 다 화면에서 한 줄의 여백이고, 이 길은
 * 되읽어 들이는 길이 아니라 내보내는 길이다.
 */
export function docToPlainText(content: Content): string {
	const nodes =
		content && typeof content === "object" && "content" in content
			? ((content.content ?? []) as Array<Record<string, unknown>>)
			: [];

	const lines = nodes.map((node) => {
		if (node.type === BLANK_ROW_TYPE) return "";
		const inline = (node.content ?? []) as Array<{ text?: string }>;
		return inline
			.map((n) => n.text ?? "")
			.join("")
			.trim();
	});

	/*
	 * 끝에 붙은 빈 줄만 걷는다.
	 *
	 * 파일 끝의 여백은 어떤 글에서도 뜻이 되지 않고, 텍스트를 다루는 도구 대부분이
	 * 저장할 때 알아서 지운다 — 남겨 두면 우리만 다른 결과를 내놓는 꼴이다.
	 * **가운데와 앞의 빈 줄은 건드리지 않는다.**
	 */
	while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

	return lines.join("\n");
}

/**
 * 파일에 적을 글 전체. 제목을 맨 위에 두고 한 줄 띄운다.
 *
 * 제목은 원고지에 조판되지 않지만(칸을 차지해서는 안 된다) 파일에서는 글의
 * 머리다. 파일 이름에도 제목이 들어가는데 그것만으로는 모자라다 — 이름이
 * 겹쳐 잘리거나, 받아 간 글만 따로 옮겨 붙일 수 있다.
 */
export function docToFileText(title: string, content: Content): string {
	const head = title.trim();
	const body = docToPlainText(content);
	if (!head) return body;
	return body ? `${head}\n\n${body}` : head;
}
