import { useEffect, useState } from "react";
import { pendingUpload } from "../model/import-legacy";

/**
 * 이 브라우저에 옛 원고가 남아 있다고 알린다.
 *
 * **비로그인이 원고 한 편으로 줄면서 생긴 자리다.** 전에 여러 편을 써 둔 사람은
 * 그것들이 화면에서 사라진 것처럼 보인다 — 지워진 것이 아니라 계정 쪽으로
 * 옮겨야 볼 수 있게 된 것이라, 그 사실을 말해 주지 않으면 잃은 줄 안다.
 *
 * 옮기는 일 자체는 로그인한 뒤 `ImportPrompt`가 묻는다. 여기서는 알리기만 한다.
 */
export function LegacyNotice() {
	/*
	 * 그린 뒤에 읽는다. 저장소는 브라우저에만 있어서 서버가 그린 것과 달라지고,
	 * 그러면 React가 이 가지를 통째로 다시 그린다.
	 */
	const [waiting, setWaiting] = useState<{
		docs: number;
		folders: number;
	} | null>(null);

	useEffect(() => {
		const found = pendingUpload();
		if (found.docs || found.folders) setWaiting(found);
	}, []);

	if (!waiting) return null;

	const 원고 = waiting.docs ? `원고 ${waiting.docs}편` : "";
	const 폴더 = waiting.folders ? `폴더 ${waiting.folders}개` : "";

	return (
		<output
			aria-live="polite"
			className="block border-border border-b bg-accent/40"
		>
			<div className="mx-auto max-w-6xl px-4 py-2 text-muted-foreground text-sm">
				로그인 없이 쓰던 {[원고, 폴더].filter(Boolean).join("와 ")}가 이
				브라우저에 남아 있습니다. 지워지지 않았습니다 — 로그인하면 계정으로
				옮길지 물어봅니다.
			</div>
		</output>
	);
}
