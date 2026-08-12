import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { type Manuscript, toPlainText } from "#/lib/export";
import { Button } from "#/shared/ui/button";

/** 복사했다고 알려 두는 시간 */
const FLASH = 1500;

/**
 * 원고 전체를 클립보드에 담는다.
 *
 * 내보내기와 같은 평문이다 — 제목이 있으면 첫 줄에 오고 빈 행은 빈 줄이 된다.
 * 다른 곳에 붙여 넣을 때 원고지 격자까지 따라갈 이유가 없다.
 */
export function CopyManuscript({ manuscript }: { manuscript: Manuscript }) {
	/*
	 * 번호를 함께 든다. 연달아 누르면 같은 결과가 이어지는데, 값이 그대로면
	 * 사라지는 시계가 다시 돌지 않아 첫 번째 것이 그냥 끝나 버린다.
	 */
	const [flash, setFlash] = useState<{
		ok: boolean;
		nth: number;
	} | null>(null);

	useEffect(() => {
		if (!flash) return;
		const timer = window.setTimeout(() => setFlash(null), FLASH);
		return () => window.clearTimeout(timer);
	}, [flash]);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(toPlainText(manuscript));
			setFlash((prev) => ({ ok: true, nth: (prev?.nth ?? 0) + 1 }));
		} catch {
			// https가 아니거나 권한이 없으면 거절당한다. 사용자가 할 수 있는 일이 없어
			// 자세히 적지 않고 실패만 알린다
			setFlash((prev) => ({ ok: false, nth: (prev?.nth ?? 0) + 1 }));
		}
	};

	const label = !flash
		? "원고 전체 복사"
		: flash.ok
			? "복사했습니다"
			: "복사하지 못했습니다";

	return (
		<Button
			variant="ghost"
			size="icon-xs"
			// 겹쳐 둔 판이 손길을 흘려보내므로 이 단추만 되돌린다
			className={`pointer-events-auto ${flash && !flash.ok ? "text-destructive" : ""}`}
			onClick={copy}
			title={label}
			aria-label={label}
		>
			{!flash ? <CopyIcon /> : flash.ok ? <CheckIcon /> : <XIcon />}
		</Button>
	);
}
