import { ConfirmDialog } from "#/shared/ui/confirm-dialog";
import { useMergePrompt } from "../model/use-merge-prompt";

/**
 * 로그인했을 때 이 기기에 두고 온 원고를 옮길지 묻는다.
 *
 * **root에 둔다.** 홈에서도 떠 있어야 하기 때문이다 — 답하기 전에는 보관함이
 * 열리지 않으므로, `_app` 안에만 두면 아무도 없는 화면에서 서로를 기다린다.
 *
 * 올리지 않기를 골라도 잃는 것이 없다. 비로그인 원고는 그 칸에 그대로 남는다.
 */
export function MergePrompt() {
	const { ask, merging, accept, decline } = useMergePrompt();

	if (!ask) return null;

	const 원고 = ask.docs ? `원고 ${ask.docs}개` : "";
	const 폴더 = ask.folders ? `폴더 ${ask.folders}개` : "";
	const 있는것 = [원고, 폴더].filter(Boolean).join("와 ");

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => !open && decline()}
			title="이 기기의 원고를 계정으로 옮길까요?"
			description={
				<>
					로그인하기 전에 이 브라우저에 쓴 {있는것}가 있습니다. 계정으로 옮기면
					다른 기기에서도 이어 쓸 수 있습니다.
					<br />
					<br />
					옮기지 않으면 이 기기에 그대로 두고, 로그아웃했을 때 다시 보입니다.
				</>
			}
			confirmLabel={merging ? "옮기는 중…" : "옮기기"}
			onConfirm={() => void accept()}
		/>
	);
}
