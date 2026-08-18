import { CircleCheckIcon, CircleDashedIcon, CircleDotIcon } from "lucide-react";
import { cn } from "#/shared/lib/utils";
import { type DocStatus, STATUS_LABEL } from "../config/status";

/**
 * 상태 하나에 아이콘 하나.
 *
 * 셋의 실루엣을 같은 원으로 맞췄다 — 윤곽만 잡힌 것(초고), 속이 찬 것(퇴고),
 * 표가 된 것(완성). 뜻을 모르고 봐도 **진행으로 읽히게** 하려는 것이고, 목록에
 * 셋이 섞여 있어도 한 계열로 보인다.
 *
 * **색은 모양 위에 덧붙는다.** 색만으로 가르면 색각 문제가 따라오므로 실루엣을
 * 먼저 두고, 색은 한눈에 훑을 때를 위한 두 번째 단서로만 쓴다 — 색을 못 보아도
 * 잃는 정보가 없다.
 *
 * 그래서 칠하는 것은 둘뿐이다. **초고에는 색을 두지 않는다** — 셋 다 칠하면
 * 목록이 신호등이 되고, 초고는 "아직 아무 일도 일어나지 않았다"라 표시할 것이
 * 없다. 값과 고른 이유는 `styles.css`의 `--status-*`에 적혀 있다.
 */
const ICON: Record<DocStatus, typeof CircleDashedIcon> = {
	draft: CircleDashedIcon,
	revising: CircleDotIcon,
	done: CircleCheckIcon,
};

const TONE: Record<DocStatus, string> = {
	draft: "text-muted-foreground",
	revising: "text-status-revising",
	done: "text-status-done",
};

/**
 * 원고가 어디까지 왔는가.
 *
 * 이름은 `title`과 `aria-label`로 남긴다 — 이 앱에는 `TooltipProvider`가 마운트되어
 * 있지 않고, 아이콘 단추들이 이미 그 두 벌로 이름을 달고 있다. 새 프로바이더를
 * 들이지 않는다.
 *
 * 크기는 감싸는 span이 정하고 아이콘은 그것을 채운다(`size-full`). 그래야 단추 안에
 * 들어갔을 때 shadcn의 `[&_svg:not([class*='size-'])]` 규칙이 제멋대로 늘리지 않는다.
 */
export function StatusIcon({
	status,
	labelled = true,
	className,
	...props
}: {
	status: DocStatus;
	/**
	 * 이름을 함께 읽힐 것인가.
	 *
	 * 글씨가 곁에 있는 자리(에디터 상단)에서는 꺼 둔다. 켜 두면 같은 이름을 두 번
	 * 읽는다.
	 */
	labelled?: boolean;
} & React.ComponentProps<"span">) {
	const Icon = ICON[status];
	const name = STATUS_LABEL[status];

	return (
		<span
			{...(labelled
				? { role: "img", "aria-label": name, title: name }
				: { "aria-hidden": true })}
			className={cn("inline-flex size-4 shrink-0", TONE[status], className)}
			{...props}
		>
			<Icon className="size-full" />
		</span>
	);
}
