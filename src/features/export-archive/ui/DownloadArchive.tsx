import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { useArchive } from "#/entities/archive";
import { Button } from "#/shared/ui/button";
import { useArchiveDownload } from "../model/use-download";

/**
 * 보관함 전체를 zip으로 받는다.
 *
 * 폴더 구조 그대로, 원고마다 평문 하나. **띄운 줄은 띄운 수만큼 남는다** —
 * 받아 간 글을 읽는 것이 사람이 아니라 기계일 때가 많고, 그때 여백은 글의
 * 짜임이라 앱이 줄여 줄 것이 아니다.
 *
 * 진행을 숫자로 보인다. 원고 수만큼 요청이 나가는 일이라 스무 편쯤 되면 몇 초가
 * 걸리는데, 아무 표시가 없으면 눌리지 않은 줄 알고 다시 누른다.
 *
 * 폴더 하나와 원고 하나를 받는 길은 트리의 ⋯ 메뉴에 있다. 담을 범위만 다르고
 * 나머지는 같은 훅이 맡는다(`model/use-download.ts`).
 */
export function DownloadArchive() {
	const { index } = useArchive();
	const { progress, busy, downloadAll } = useArchiveDownload();

	const count = index.docs.length;

	return (
		<Button
			variant="ghost"
			size="sm"
			className="w-full justify-start text-muted-foreground"
			onClick={async () => {
				await downloadAll();
			}}
			disabled={busy || count === 0}
		>
			{busy ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
			전체 받기
			<span className="ml-auto tabular-nums">
				{progress ? `${progress.done}/${progress.total}` : count > 0 && count}
			</span>
		</Button>
	);
}
