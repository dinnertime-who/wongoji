import { lazy, Suspense } from "react";
import type { WongojiEditorProps } from "./WongojiEditor";

/**
 * 에디터를 첫 짐에서 뺀다.
 *
 * TipTap과 ProseMirror가 **348KB(gzip 107KB)**로 이 앱에서 가장 무겁다. 그런데
 * 그것을 다 받아 놓아도 첫 화면에는 아무것도 보태지 않는다 — 에디터는 DOM이
 * 있어야 서므로 서버가 그리지 못하고, 본문도 브라우저가 따로 받아 와야 하기
 * 때문이다. **`load.state === "ready"`가 되기 전에는 그릴 것 자체가 없다.**
 *
 * 그래서 필요해질 때 받는다. 본문이 도착하는 시점과 이 덩이가 도착하는 시점이
 * 겹치므로 기다림이 늘어나지 않고, 그동안 주 스레드는 껍데기를 세우는 데 쓴다.
 *
 * 대기 화면은 두지 않는다. 여기가 비어 보이는 것은 원래 본문을 기다리는 동안의
 * 모습이고, 자리표시자를 넣으면 그것이 한 번 더 깜빡이는 것으로만 보인다.
 */
const Inner = lazy(() =>
	import("./WongojiEditor").then((m) => ({ default: m.WongojiEditor })),
);

export function WongojiEditor(props: WongojiEditorProps) {
	return (
		<Suspense fallback={null}>
			<Inner {...props} />
		</Suspense>
	);
}
