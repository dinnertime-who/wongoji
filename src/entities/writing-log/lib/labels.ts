import type { GrassCell, GrassWeek } from "../model/types";

/**
 * 잔디 한 칸을 말로 옮긴다.
 *
 * 색만으로는 "쉰 날"과 "덜어낸 날"이 갈리지 않는다 — 둘 다 옅기 때문이다. 그
 * 구별이 이 잔디의 요점이라, 읽어 주는 말에서는 그것을 분명히 한다.
 */
export function describeDay(cell: GrassCell): string {
	const 날 = `${Number(cell.day.slice(5, 7))}월 ${Number(cell.day.slice(8, 10))}일`;

	if (cell.level === 0) return `${날} — 기록 없음`;
	if (cell.chars > 0) return `${날} — ${cell.chars.toLocaleString()}자`;
	if (cell.chars < 0) {
		return `${날} — ${(-cell.chars).toLocaleString()}자 덜어냄`;
	}
	// 늘지도 줄지도 않았는데 줄은 있다. 오타를 고쳤거나 문장을 바꿔 앉힌 날이다
	return `${날} — 손봄`;
}

/**
 * 달이 바뀌는 자리. 격자 위에 달 이름을 놓으려고 센다.
 *
 * **그 주의 일요일이 속한 달**로 친다. 주 하나가 두 달에 걸치는 일이 흔한데,
 * 그때 라벨을 둘 다 놓으면 한 칸 폭에 두 글자가 겹친다.
 *
 * 첫 줄에는 놓지 않는다. 격자 왼쪽 끝은 그 달의 도중에서 잘려 있어서, 거기에
 * 달 이름을 적으면 그 달이 통째로 보이는 것처럼 읽힌다.
 */
export function monthMarks(grid: GrassWeek[]): { at: number; label: string }[] {
	const marks: { at: number; label: string }[] = [];
	let last: string | null = null;

	grid.forEach((week, at) => {
		const first = week.days.find(Boolean);
		if (!first) return;

		const month = first.day.slice(0, 7);
		if (month !== last && last !== null) {
			marks.push({ at, label: `${Number(month.slice(5))}월` });
		}
		last = month;
	});
	return marks;
}
