import { TriangleAlertIcon } from "lucide-react";
import type { SaveFailure } from "#/shared/lib/storage";
import { Button } from "#/shared/ui/button";

/**
 * 저장이 실패했음을 알린다.
 *
 * 사라지는 알림으로 두지 않는다. 원고가 이 브라우저에만 있고 서버 사본이 없어서,
 * 저장이 안 되는 동안 계속 쓰면 그만큼 잃는다. 저장이 다시 성공할 때까지 남는다.
 */
export function SaveErrorBanner({
	failure,
	onBackup,
}: {
	failure: SaveFailure;
	/**
	 * 지금 보고 있는 원고를 파일로 내려받는다.
	 *
	 * 내려받을 원고가 없는 화면도 있다 — 폴더 쪽에서 실패하는 것은 색인이라
	 * 백업할 본문이 없다. 그때는 단추를 그리지 않는다.
	 */
	onBackup?: () => void;
}) {
	return (
		<output
			aria-live="assertive"
			className="block border-destructive/30 border-b bg-destructive/10"
		>
			<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
				<TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
				<span className="min-w-0 flex-1 text-destructive">
					{failure.message}
				</span>
				{onBackup && (
					<Button size="sm" variant="outline" onClick={onBackup}>
						백업 받기
					</Button>
				)}
			</div>
		</output>
	);
}
