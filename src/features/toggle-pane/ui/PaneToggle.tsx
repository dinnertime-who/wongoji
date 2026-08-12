import { Switch } from "#/shared/ui/switch";
import { PANE_LABEL, type Pane } from "../model/pane";

/** 두 쪽 중 하나를 고르는 것이라 스위치 양옆에 이름을 둔다 */
export function PaneToggle({
	pane,
	onChoose,
}: {
	pane: Pane;
	onChoose: (pane: Pane) => void;
}) {
	const label = (which: Pane) =>
		`text-xs transition-colors ${
			pane === which ? "text-foreground" : "text-muted-foreground"
		}`;

	return (
		<div className="flex items-center gap-2">
			<button
				type="button"
				onClick={() => onChoose("write")}
				className={label("write")}
			>
				{PANE_LABEL.write}
			</button>
			<Switch
				checked={pane === "preview"}
				onCheckedChange={(on) => onChoose(on ? "preview" : "write")}
				aria-label="원고지 미리보기"
			/>
			<button
				type="button"
				onClick={() => onChoose("preview")}
				className={label("preview")}
			>
				{PANE_LABEL.preview}
			</button>
		</div>
	);
}
