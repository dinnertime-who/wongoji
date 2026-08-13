import { useCallback } from "react";
import { type Path, useArchiveMutation } from "#/entities/archive";
import { emptyDoc, writeDoc } from "#/entities/manuscript";
import type { SaveResult } from "#/shared/lib/storage";

/**
 * 원고와 폴더를 만든다.
 *
 * 색인과 본문을 함께 건드리는 일이라 여기 모아 둔다. 화면 여러 곳에서 같은
 * 순서를 각자 적으면 반드시 갈라지므로 — 실제로 갈라져 있었다 — 한 벌만 둔다.
 *
 * **id는 서버가 정한다.** 전에는 브라우저가 여덟 자 난수를 지어냈고, 그것이
 * 다른 기기의 id와 부딪히는 것을 피하려고 로그인할 때마다 다시 매기는 코드가
 * 따로 있었다. 만드는 자리를 한 곳으로 모으면 그 일이 없다.
 */

/** 만들어진 원고. 실패했으면 `docId`가 빈 문자열이다 */
export interface Created {
	docId: string;
	result: SaveResult;
}

const 못만듦: SaveResult = {
	ok: false,
	kind: "offline",
	message: "원고를 만들지 못했습니다. 연결을 확인해 주세요.",
};

export function useCreateEntry() {
	const change = useArchiveMutation();

	/** 그 폴더 안에 빈 원고를 만든다 */
	const createDocIn = useCallback(
		async (path: Path): Promise<Created> => {
			const made = await change({ kind: "createDoc", path });
			if (!made?.createdDocId) return { docId: "", result: 못만듦 };

			/*
			 * 본문을 반드시 써 둔다. 색인에만 있고 본문이 없는 원고는 "본문을
			 * 잃었다"는 뜻으로 읽히므로, 갓 만든 원고가 그렇게 보여서는 안 된다.
			 *
			 * 실패해도 되돌리지 않는다. 못 보낸 본문은 대기열에 남고 읽기가 그쪽을
			 * 먼저 보므로, 사용자에게는 이미 있는 원고다 — 연결이 돌아오면 올라간다.
			 */
			const body = await writeDoc(made.createdDocId, emptyDoc());
			return { docId: made.createdDocId, result: body };
		},
		[change],
	);

	/**
	 * 원고를 복제한다. **본문은 서버가 벤다.**
	 *
	 * 브라우저를 시키지 않는 이유는 그쪽이 본문을 들고 있다는 보장이 없어서다 —
	 * 열어 본 적 없는 원고를 목록에서 바로 복제할 수 있다.
	 */
	const duplicateDocById = useCallback(
		async (id: string): Promise<Created> => {
			const made = await change({ kind: "duplicateDoc", id });
			// 없는 원고를 복제하려 했다. 실패는 아니지만 갈 곳도 없다
			if (!made) return { docId: "", result: 못만듦 };
			return { docId: made.createdDocId ?? "", result: { ok: true } };
		},
		[change],
	);

	const createFolderIn = useCallback(
		async (name: string, path: Path): Promise<void> => {
			await change({ kind: "createFolder", name, path });
		},
		[change],
	);

	return { createDocIn, duplicateDocById, createFolderIn };
}
