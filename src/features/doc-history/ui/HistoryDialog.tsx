import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ARCHIVE_KEY, STATUS_LABEL } from "#/entities/archive";
import { docQueryKey } from "#/entities/manuscript";
import { Button } from "#/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/shared/ui/dialog";
import {
	type DocVersion,
	fetchVersions,
	restoreVersion,
	versionsQueryKey,
} from "../api/version-api";

/**
 * 원고의 이력.
 *
 * 상태를 올릴 때마다 그때의 원고가 남는다. 여기서 골라 되돌린다.
 *
 * **되돌리기에 확인을 받지 않는다.** 되돌리기 전에 지금 원고도 이력에 남으므로
 * 되돌릴 수 있는 일이고, 되돌릴 수 있는 일에 확인을 받으면 확인 자체가
 * 값싸진다 — 휴지통에서 정한 규칙 그대로다. 대신 그 사실을 아래에 적어 둔다.
 */
export function HistoryDialog({
	docId,
	open,
	onOpenChange,
}: {
	docId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const client = useQueryClient();
	const [working, setWorking] = useState<string | null>(null);

	const { data: versions, isPending } = useQuery({
		queryKey: versionsQueryKey(docId),
		queryFn: () => fetchVersions(docId),
		enabled: open && Boolean(docId),
	});

	const restore = async (versionId: string) => {
		setWorking(versionId);
		try {
			const index = await restoreVersion(docId, versionId);
			client.setQueryData(ARCHIVE_KEY, index);
			/*
			 * 본문과 이력을 다시 읽게 한다. 캐시는 스스로 낡지 않으므로
			 * (`staleTime: Infinity`) 비워 주지 않으면 옛 본문이 그대로 보인다.
			 */
			client.removeQueries({ queryKey: docQueryKey(docId) });
			await client.invalidateQueries({ queryKey: versionsQueryKey(docId) });
			onOpenChange(false);
		} finally {
			setWorking(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>이력</DialogTitle>
					<DialogDescription>
						상태를 올릴 때마다 그때의 원고가 남습니다.
					</DialogDescription>
				</DialogHeader>

				{isPending ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						읽는 중…
					</p>
				) : !versions?.length ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						아직 남은 것이 없습니다. 원고를 퇴고나 완성으로 올리면 그때의 원고가
						여기 남습니다.
					</p>
				) : (
					<>
						<ul className="max-h-96 divide-y divide-border overflow-auto rounded border border-border">
							{versions.map((version) => (
								<Row
									key={version.id}
									version={version}
									busy={working === version.id}
									onRestore={() => void restore(version.id)}
								/>
							))}
						</ul>
						<p className="text-muted-foreground text-xs">
							되돌리기 전에 지금 원고도 이력에 남습니다.
						</p>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

function Row({
	version,
	busy,
	onRestore,
}: {
	version: DocVersion;
	busy: boolean;
	onRestore: () => void;
}) {
	return (
		<li className="flex items-start gap-3 px-3 py-2.5 text-sm">
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2 text-xs">
					<span className="font-medium">{label(version)}</span>
					<span className="text-muted-foreground tabular-nums">
						{when(version.createdAt)}
					</span>
					<span className="text-muted-foreground tabular-nums">
						{version.sheets}매
					</span>
				</div>
				{/*
				 * 발췌를 반드시 보여준다. 날짜만 있으면 어느 것인지 모른 채 되돌리게 된다.
				 */}
				<p className="mt-0.5 truncate text-muted-foreground text-xs">
					{version.excerpt || "(빈 원고)"}
				</p>
			</div>
			<Button
				variant="outline"
				size="sm"
				disabled={busy}
				onClick={onRestore}
				className="shrink-0"
			>
				{busy ? "되돌리는 중…" : "되돌리기"}
			</Button>
		</li>
	);
}

/**
 * 줄머리에 적을 말.
 *
 * 되돌리기 직전에 챙겨 둔 것은 어느 상태로 올라간 것이 아니다. 그것을 상태인
 * 척 적으면 이력이 거짓말을 한다.
 */
function label(version: DocVersion): string {
	if (version.kind === "backup") return "되돌리기 전";
	return version.status ? STATUS_LABEL[version.status] : "저장 시점";
}

const when = (at: number): string =>
	new Date(at).toLocaleString("ko-KR", {
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
