import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useArchive } from "#/entities/archive";
import { Button } from "#/shared/ui/button";
import {
	archiveFileName,
	buildArchiveZip,
	downloadZip,
} from "../api/build-archive-zip";
import { toZipEntries } from "../lib/tree";

/**
 * 보관함 전체를 zip으로 받는다.
 *
 * 폴더 구조 그대로, 원고마다 평문 하나. **띄운 줄은 띄운 수만큼 남는다** —
 * 받아 간 글을 읽는 것이 사람이 아니라 기계일 때가 많고, 그때 여백은 글의
 * 짜임이라 앱이 줄여 줄 것이 아니다.
 *
 * 진행을 숫자로 보인다. 원고 수만큼 요청이 나가는 일이라 스무 편쯤 되면 몇 초가
 * 걸리는데, 아무 표시가 없으면 눌리지 않은 줄 알고 다시 누른다.
 */
export function DownloadArchive() {
	const { index } = useArchive();
	const [progress, setProgress] = useState<{
		done: number;
		total: number;
	} | null>(null);

	const busy = progress !== null;
	const count = index.docs.length;

	const run = async () => {
		if (busy) return;

		const entries = toZipEntries(index);
		if (entries.length === 0) {
			toast("받을 원고가 없습니다");
			return;
		}

		setProgress({ done: 0, total: entries.length });
		try {
			const { blob, missed } = await buildArchiveZip(entries, setProgress);
			downloadZip(blob, archiveFileName(new Date()));

			/*
			 * 못 담은 것이 있으면 반드시 알린다. 조용히 빠뜨리면 받아 간 사람은
			 * 그 원고를 애초에 쓰지 않았다고 여긴다.
			 */
			if (missed.length > 0) {
				toast.error(`${missed.length}편을 담지 못했습니다`, {
					description: missed.slice(0, 3).join(" · "),
				});
			}
		} catch {
			toast.error("보관함을 받지 못했습니다");
		} finally {
			setProgress(null);
		}
	};

	return (
		<Button
			variant="ghost"
			size="sm"
			className="w-full justify-start text-muted-foreground"
			onClick={run}
			disabled={busy || count === 0}
		>
			{busy ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
			전체 받기
			<span className="ml-auto tabular-nums">
				{busy ? `${progress.done}/${progress.total}` : count > 0 && count}
			</span>
		</Button>
	);
}
