import { ConfirmDialog } from "#/shared/ui/confirm-dialog";
import { useArchiveSync } from "../model/use-archive-sync";

/**
 * 계정 보관함과 이 기기를 맞추고, 물어볼 것이 있으면 묻는다.
 *
 * 그리는 것은 다이얼로그 하나뿐이고 나머지는 뒤에서 돈다. 어디에 두어도 되지만
 * 보관함을 쓰는 모든 쪽이 지나는 자리에 두어야 한다 — `_app` 레이아웃이 그것이다.
 *
 * 아무것도 막지 않는다. 묻는 동안에도 뒤에서 원고를 쓸 수 있고, 올리지 않기를
 * 골라도 잃는 것이 없다.
 */
export function ArchiveSync() {
	const { ask, merging, accept, decline } = useArchiveSync();

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
