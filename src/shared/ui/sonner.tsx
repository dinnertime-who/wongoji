import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * 스쳐 가는 알림.
 *
 * **원고를 잃을 수 있는 실패는 여기로 오지 않는다.** 그런 것은 사라지지 않는
 * 배너(`SaveErrorBanner`)가 받는다 — 저장이 안 되는 동안 계속 쓰면 그만큼
 * 잃으므로, 사용자가 놓칠 수 있는 알림에 실어서는 안 된다.
 *
 * 여기 오는 것은 "이미 처리했고 알려만 두는" 종류다. 완성본을 고쳐서 퇴고로
 * 내렸다는 것 같은.
 *
 * shadcn이 찍어 준 원본은 `next-themes`로 테마를 물어보는데, 이 앱은 밝은 쪽
 * 하나뿐이라 걷어냈다(다크 모드를 만들지 않기로 했다 — `docs/plan-ui-ux-ideas.md`).
 */
export function Toaster(props: ToasterProps) {
	return (
		<Sonner
			theme="light"
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "var(--radius)",
				} as React.CSSProperties
			}
			toastOptions={{ classNames: { toast: "cn-toast" } }}
			{...props}
		/>
	);
}
