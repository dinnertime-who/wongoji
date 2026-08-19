import type { Content } from "@tiptap/react";
import { docToFileText, readDoc, safeFileName } from "#/entities/manuscript";

/**
 * 만든 파일을 브라우저에 내려 준다.
 *
 * zip도 평문 한 편도 여기를 지난다 — 내려 주는 일은 형식과 상관이 없고, 두 벌로
 * 두면 한쪽만 `revokeObjectURL`을 빠뜨리는 식으로 갈린다.
 */
export function download(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * 원고 한 편을 평문 하나로 받는다.
 *
 * **zip으로 싸지 않는다.** 파일 하나를 담자고 압축을 씌우면 받아 간 사람이 한 번
 * 더 풀어야 하고, 폴더 구조라고 할 것도 없다.
 *
 * 본문은 zip을 만들 때와 같은 길로 읽는다(`readDoc`). 미전송 대기열을 먼저 보므로
 * 저장에 실패한 채 남아 있던 글도 이쪽으로는 제대로 나온다 — 받는 자리에서
 * 그것을 잃으면 받는 뜻이 없다.
 *
 * **못 읽으면 던진다.** 빈 파일을 내려 주면 받아 간 사람은 원고가 비어 있었다고
 * 여기고, 그것이 손에 남은 유일한 사본일 수 있다.
 */
export async function downloadDocText(docId: string, title: string) {
	const content = await readDoc(docId);
	if (content == null) throw new Error("본문을 찾지 못했습니다");

	download(
		new Blob([docToFileText(title, content as Content)], {
			type: "text/plain;charset=utf-8",
		}),
		`${safeFileName(title)}.txt`,
	);
}
