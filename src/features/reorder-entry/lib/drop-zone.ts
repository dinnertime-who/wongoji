import {
	childrenOf,
	fullPath,
	type Path,
	type Placement,
	type StoreIndex,
} from "#/entities/archive";

/**
 * 줄의 어디에 손이 있는가.
 *
 * 놓는 자리를 정하는 일이 순수 함수 하나로 떨어진다. 마우스는 `clientY`와
 * 줄의 사각형에서, 손가락은 좌표로 찾아낸 줄의 사각형에서 같은 값을 얻는다 —
 * **양쪽이 같은 계산을 지나야** 손으로 하는 것과 마우스로 하는 것이 어긋나지 않는다.
 */
export type DropZone = "before" | "into" | "after";

/** 줄 하나가 스스로를 알리는 것 */
export interface DropRow {
	kind: "doc" | "folder";
	id: string;
	/** 이 줄이 놓여 있는 자리. 폴더면 제 안쪽이 아니라 제가 선 자리다 */
	path: Path;
}

/** 폴더 줄에서 앞뒤로 잡아 두는 몫. 나머지 가운데가 "안으로"다 */
const EDGE = 0.25;

/**
 * 이 줄의 어디에 놓으려는 것인가.
 *
 * **끼우는 자리는 같은 종류의 줄에서만 잡는다.** 폴더는 늘 원고 위에 오므로
 * 원고를 폴더 줄 사이에 끼울 수가 없다 — 그런 자리에 선을 그으면 놓은 뒤에
 * 엉뚱한 데로 간다. 종류가 다른 줄은 통째로 "안으로"다.
 *
 * 폴더 줄은 앞뒤로 25%씩만 내준다. 가운데를 넓게 두어야 폴더에 집어넣기가
 * 쉽다 — 그것이 폴더 줄에 놓는 가장 잦은 뜻이다.
 *
 * 펴져 있는 폴더의 아래 끝도 그대로 "뒤"다. 바로 아래에 자식 줄이 있어
 * 헷갈릴 법하지만, 표시선을 **그 폴더의 들여쓰기에 맞춰** 그으므로 자식 층에
 * 그어지는 선과 눈으로 갈린다. 자식 맨 앞에 넣고 싶으면 그 자식의 위쪽 절반에
 * 놓으면 된다.
 */
export function zoneOf(
	rect: { top: number; height: number },
	y: number,
	row: { kind: "doc" | "folder" },
	moving: { kind: "doc" | "folder" },
): DropZone {
	if (row.kind !== moving.kind) return "into";

	const at =
		rect.height > 0
			? Math.min(1, Math.max(0, (y - rect.top) / rect.height))
			: 0.5;

	if (row.kind === "doc") return at < 0.5 ? "before" : "after";
	if (at < EDGE) return "before";
	if (at > 1 - EDGE) return "after";
	return "into";
}

/**
 * 손이 놓인 자리를 색인의 자리로 옮긴다.
 *
 * "안으로"는 폴더 줄이면 그 폴더 안 맨 끝, 원고 줄이면 그 원고가 놓인 자리의
 * 맨 끝이다. 후자는 폴더를 끌어 원고 줄에 떨어뜨렸을 때다 — 촘촘한 목록에서
 * 폴더 줄만 노려 맞히지 않아도 되게 예전부터 받아 주던 자리다.
 */
export function placementFor(
	index: StoreIndex,
	row: DropRow,
	zone: DropZone,
): Placement {
	if (zone === "into") {
		return {
			path: row.kind === "folder" ? fullPath(row) : row.path,
			before: null,
		};
	}

	const kids = childrenOf(index, row.path);
	const list: { id: string }[] =
		row.kind === "folder" ? kids.folders : kids.docs;
	const at = list.findIndex((e) => e.id === row.id);

	/*
	 * "뒤"는 다음 형제의 앞이다. 다음이 없으면 맨 끝이라는 뜻이다.
	 *
	 * 다음 형제가 하필 지금 끌고 있는 그것이면 `before`가 제 id가 되는데,
	 * `placeEntry`가 그것을 제자리로 읽는다 — 그리고 실제로 제자리가 맞다.
	 */
	return {
		path: row.path,
		before: zone === "before" ? row.id : (list[at + 1]?.id ?? null),
	};
}
