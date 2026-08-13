import { ConfirmDialog } from "#/shared/ui/confirm-dialog";
import { useImportPrompt } from "../model/use-import-prompt";

/**
 * 로그인했을 때 이 브라우저에 두고 온 옛 원고를 옮길지 묻는다.
 *
 * 옮기지 않기를 골라도 잃는 것이 없다. 옛 원고는 이 브라우저에 그대로 남고,
 * 다음에 로그인할 때 다시 묻는다.
 */
export function ImportPrompt() {
	const { ask, working, accept, decline } = useImportPrompt();

	if (!ask) return null;

	const 원고 = ask.docs ? `원고 ${ask.docs}개` : "";
	const 폴더 = ask.folders ? `폴더 ${ask.folders}개` : "";
	const 있는것 = [원고, 폴더].filter(Boolean).join("와 ");

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => !open && decline()}
			title="이 브라우저에 남은 원고를 계정으로 옮길까요?"
			description={
				<>
					로그인 없이 쓰던 시절에 이 브라우저에 남긴 {있는것}가 있습니다.
					계정으로 옮기면 다른 기기에서도 이어 쓸 수 있습니다.
					<br />
					<br />
					옮기지 않으면 이 브라우저에 그대로 두고, 다음에 로그인할 때 다시
					묻습니다.
				</>
			}
			confirmLabel={working ? "옮기는 중…" : "옮기기"}
			onConfirm={() => void accept()}
		/>
	);
}
