import { useState } from "react";
import { toast } from "sonner";
import {
	type DocEntry,
	displayTitle,
	type FolderEntry,
	useArchive,
} from "#/entities/archive";
import {
	type ArchiveZipProgress,
	archiveFileName,
	buildArchiveZip,
	downloadZip,
} from "../api/build-archive-zip";
import { downloadDocText } from "../api/download";
import { toZipEntries, WHOLE_ARCHIVE, type ZipScope } from "../lib/tree";

/**
 * 받는 일 셋 — 보관함 전체, 폴더 하나, 원고 하나.
 *
 * 셋이 한 훅에 있는 것은 **가르는 것이 담을 범위뿐이기** 때문이다. 읽는 길도
 * (`readDoc` — 미전송 대기열을 먼저 본다), 적는 글자도(`docToFileText` — 띄운 줄을
 * 그대로 둔다), 못 담은 것을 알리는 방식도 같다. 세 벌로 두면 그중 하나만 고쳐진다.
 *
 * **진행을 어디에 그리는지만 다르다.** 발치의 "전체 받기"는 제 단추 안에 숫자를
 * 그릴 자리가 있어 `progress`를 읽어 간다. ⋯ 메뉴에서 부른 것은 누르는 순간 메뉴가
 * 닫혀 그릴 자리가 없으므로 토스트를 빌린다 — 원고가 스무 편쯤 되면 몇 초가 걸리는
 * 일이라, 아무 표시가 없으면 눌리지 않은 줄 알고 다시 누른다.
 *
 * 이름 뒤에 붙는 조사를 피해 **"폴더를"·"원고를"로 받는다.** 사람이 지은 이름에
 * 을/를을 붙이면 받침에 따라 어긋나고, 그것을 가리는 규칙을 앱이 들 이유가 없다.
 */
export interface ArchiveDownload {
	/** 지금 담고 있는 것. 없으면 null */
	progress: ArchiveZipProgress | null;
	busy: boolean;
	downloadAll: () => Promise<void>;
	downloadFolder: (folder: FolderEntry) => Promise<void>;
	downloadDoc: (doc: DocEntry) => Promise<void>;
}

/**
 * 다 받은 뒤 토스트가 머무는 시간(ms).
 *
 * **적어 주지 않으면 영영 머문다.** 진행을 그리던 토스트를 그 자리에서 고쳐 쓰는데,
 * `toast.loading`이 잡아 둔 무한 시간이 고친 뒤에도 그대로 남기 때문이다. sonner의
 * 기본값과 같은 수를 적는다.
 */
const SETTLED = 4000;

export function useArchiveDownload(): ArchiveDownload {
	const { index } = useArchive();
	const [progress, setProgress] = useState<ArchiveZipProgress | null>(null);
	const busy = progress !== null;

	/**
	 * zip 하나를 만들어 내려 준다.
	 *
	 * 담을 것이 없으면 `null`이다. 담았으면 몇 편을 넣었는지와 **못 담은 원고
	 * 목록**을 돌려준다 — 빈 목록이 성공이다. 실패는 던진다. 알리는 일은 부르는
	 * 쪽이 한다: 같은 실패라도 발치의 단추와 ⋯ 메뉴가 할 말이 다르다.
	 */
	const runZip = async (
		scope: ZipScope,
		name: string,
		onProgress?: (p: ArchiveZipProgress) => void,
	): Promise<{ packed: number; missed: string[] } | null> => {
		const entries = toZipEntries(index, scope);
		if (entries.length === 0) return null;

		setProgress({ done: 0, total: entries.length });
		try {
			const { blob, missed } = await buildArchiveZip(entries, (p) => {
				setProgress(p);
				onProgress?.(p);
			});
			downloadZip(blob, archiveFileName(new Date(), name));
			return { packed: entries.length - missed.length, missed };
		} finally {
			setProgress(null);
		}
	};

	/**
	 * 못 담은 것이 있으면 반드시 알린다.
	 *
	 * 조용히 빠뜨리면 받아 간 사람은 그 원고를 애초에 쓰지 않았다고 여긴다.
	 */
	const warnMissed = (missed: string[]) => {
		if (missed.length === 0) return;
		toast.error(`${missed.length}편을 담지 못했습니다`, {
			description: missed.slice(0, 3).join(" · "),
		});
	};

	const downloadAll = async () => {
		if (busy) return;
		try {
			const result = await runZip(WHOLE_ARCHIVE, "원고지-보관함");
			if (result === null) {
				toast("받을 원고가 없습니다");
				return;
			}
			warnMissed(result.missed);
		} catch {
			toast.error("보관함을 받지 못했습니다");
		}
	};

	const downloadFolder = async (folder: FolderEntry) => {
		if (busy) return;

		/*
		 * 토스트 하나를 잡아 두고 그 자리에서 고쳐 쓴다. id를 주지 않으면 진행
		 * 숫자가 바뀔 때마다 새 토스트가 쌓여 화면이 덮인다.
		 */
		const id = `download-folder:${folder.id}`;
		const label = `'${folder.name}' 폴더`;
		toast.loading(`${label} 받는 중…`, { id });

		try {
			const result = await runZip(
				{ kind: "folder", folder },
				folder.name,
				({ done, total }) =>
					toast.loading(`${label} 받는 중…`, {
						id,
						description: `${done}/${total}`,
					}),
			);
			if (result === null) {
				toast(`${label}에 받을 원고가 없습니다`, { id, duration: SETTLED });
				return;
			}
			/*
			 * 끝난 자리에도 설명을 준다. 같은 토스트를 고쳐 쓰는 것이라, 비워 두면
			 * 진행하며 적어 둔 `3/12`가 다 받은 뒤에도 그대로 남는다.
			 */
			toast.success(`${label}를 받았습니다`, {
				id,
				description: `원고 ${result.packed}편`,
				duration: SETTLED,
			});
			warnMissed(result.missed);
		} catch {
			// 진행을 적어 둔 토스트를 물리고 새로 띄운다. 고쳐 쓰면 `3/12`가 남는다
			toast.dismiss(id);
			toast.error(`${label}를 받지 못했습니다`);
		}
	};

	/*
	 * 원고 한 편은 요청 하나라 진행을 그리지 않는다. 성공도 알리지 않는다 —
	 * 브라우저가 받은 파일을 제 자리에 보여 주므로 우리가 한 번 더 말할 것이 없다.
	 */
	const downloadDoc = async (doc: DocEntry) => {
		try {
			await downloadDocText(doc.id, doc.title);
		} catch {
			toast.error(`'${displayTitle(doc)}' 원고를 받지 못했습니다`);
		}
	};

	return { progress, busy, downloadAll, downloadFolder, downloadDoc };
}
