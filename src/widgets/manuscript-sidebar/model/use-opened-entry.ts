import { useParams } from "@tanstack/react-router";

/**
 * 지금 열어 둔 원고와 폴더.
 *
 * 주소에서 읽는다. 물려받지 않는 것이 중요하다 — 보관함은 원고 쪽과 폴더 쪽이
 * 함께 쓰는데, 그 둘을 감싸는 레이아웃은 어느 쪽이 열렸는지 모른다. 물려주려면
 * 레이아웃이 쪽마다 다시 마운트되어야 하고, 그러면 접힘 상태와 펼친 폴더가
 * 옮겨 다닐 때마다 초기화된다.
 *
 * `strict: false`는 "이 라우트가 아닐 수도 있다"는 뜻이다. 원고 쪽에는 folderId가,
 * 폴더 쪽에는 docId가 없다.
 */
export function useOpenedEntry(): { docId: string; folderId?: string } {
	return useParams({
		strict: false,
		select: (params) => {
			const p = params as { docId?: string; folderId?: string };
			return { docId: p.docId ?? "", folderId: p.folderId };
		},
	});
}
