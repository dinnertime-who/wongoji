import { useMemo, useState } from "react";
import { ScrollArea } from "#/shared/ui/scroll-area";
import { buildGrid } from "../lib/grid";
import { describeDay, monthMarks } from "../lib/labels";
import type { GrassCell, WritingLog } from "../model/types";

/**
 * 날마다 얼마나 썼는가 — 한 칸이 하루다.
 *
 * 세로 한 줄이 한 주고 일요일이 맨 위다. 오른쪽 끝이 이번 주라, **좁은 화면에서는
 * 오른쪽 끝이 먼저 보여야 한다** — 사람이 궁금한 것은 작년 3월이 아니라 이번 주다.
 */

/** 한 칸의 변과 칸 사이. px로 못박는다 — 격자는 늘어나면 격자가 아니다 */
const CELL = 10;
const GAP = 3;
const STEP = CELL + GAP;

/**
 * 진하기별 색. **문자열을 그대로 적는다.**
 *
 * `bg-grass-${level}`로 지으면 Tailwind가 소스에서 그 이름을 찾지 못해 클래스가
 * 아예 만들어지지 않는다 — 화면에서는 칸이 전부 투명해진다.
 */
const FILL = [
	"bg-grass-0",
	"bg-grass-1",
	"bg-grass-2",
	"bg-grass-3",
	"bg-grass-4",
] as const;

/** 왼쪽에 적는 요일. 셋만 적는다 — 일곱을 다 적으면 격자보다 글자가 빽빽하다 */
const WEEKDAYS = ["", "월", "", "수", "", "금", ""];

export function GrassGrid({
	today,
	log,
	weeks = 53,
}: {
	today: string;
	log: WritingLog;
	weeks?: number;
}) {
	const grid = useMemo(() => buildGrid(today, log, weeks), [today, log, weeks]);
	const marks = useMemo(() => monthMarks(grid), [grid]);

	/** 날짜로 칸을 되찾는다. 손짓을 위에서 한 번만 받으므로 되찾을 길이 필요하다 */
	const cells = useMemo(() => {
		const map = new Map<string, GrassCell>();
		for (const week of grid) {
			for (const cell of week.days) if (cell) map.set(cell.day, cell);
		}
		return map;
	}, [grid]);

	/*
	 * 지금 짚고 있는 칸.
	 *
	 * 읽어 줄 자리를 아래 하나만 둔다. 칸마다 툴팁을 달지 않는 이유는 수 때문이다 —
	 * 371개다. 손짓도 여기서 한 번만 받아 `data-day`로 되찾는다.
	 */
	const [poked, setPoked] = useState<GrassCell | null>(null);

	const 짚기 = (event: React.MouseEvent) => {
		const day = (event.target as HTMLElement).dataset.day;
		setPoked(day ? (cells.get(day) ?? null) : null);
	};

	/**
	 * 격자 전체를 한 장의 그림으로 읽어 준다.
	 *
	 * 칸마다 `aria-label`을 달면 화면 낭독기가 371줄을 읽는다 — 그것은 잔디가
	 * 주려던 "한눈에"의 정반대다. 하루하루가 궁금한 사람에게는 원고 목록이 이미
	 * 있고, 이 그림이 말해야 하는 것은 **얼마나 자주 썼는가** 한 줄이다.
	 */
	const 요약 = `지난 ${weeks}주 가운데 ${cells.size ? [...cells.values()].filter((c) => c.level > 0).length : 0}일을 썼습니다`;

	return (
		<div>
			<div className="flex gap-1">
				{/*
				 * 요일은 격자 밖에 둔다. 안에 넣으면 함께 흘러가서, 오른쪽 끝을 보고
				 * 있을 때 정작 무슨 요일인지가 화면 밖에 있다.
				 */}
				<div
					className="flex shrink-0 flex-col text-[10px] text-muted-foreground"
					style={{ gap: GAP, paddingTop: 16 }}
					aria-hidden
				>
					{WEEKDAYS.map((label, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: 요일은 자리가 곧 이름이다
							key={i}
							className="flex items-center leading-none"
							style={{ height: CELL }}
						>
							{label}
						</div>
					))}
				</div>

				{/*
				 * **`dir`로 오른쪽 끝에서 시작한다.**
				 *
				 * effect에서 `scrollLeft`를 밀 수도 있지만, 그러면 첫 그림이 왼쪽 끝
				 * (작년)에 그려졌다가 한 프레임 뒤에 튄다. rtl 스크롤러는 브라우저가
				 * 처음부터 오른쪽에 세우므로 튈 자리가 없다 — 안쪽을 ltr로 되돌려
				 * 격자 자체는 왼쪽에서 오른쪽으로 흐르게 둔다.
				 *
				 * ScrollArea는 제 안에 진짜 스크롤 칸(viewport)을 두므로 이 트릭이
				 * 그대로 산다. `dir`을 Root에 주면 Radix가 스크롤바 방향까지 함께
				 * 맞춘다.
				 *
				 * `type="auto"`인 것은 **넘친다는 표시가 있어야 하기 때문이다.**
				 * 기본값(`hover`)은 손을 얹어야 스크롤바가 뜨는데, 가로로 더 있다는
				 * 것을 모르는 사람은 손을 얹을 이유가 없다. 세로 스크롤과 달리 가로는
				 * 있으리라 짐작하지 않는다.
				 */}
				<ScrollArea
					className="min-w-0 flex-1"
					orientation="horizontal"
					dir="rtl"
					type="auto"
				>
					<div dir="ltr" className="w-max pb-1">
						{/* 달 이름. 칸 폭에 맞춰 자리를 잡느라 절대 위치로 놓는다 */}
						<div className="relative h-4 text-[10px] text-muted-foreground">
							{marks.map((mark) => (
								<span
									key={mark.label}
									className="absolute top-0 leading-none"
									style={{ left: mark.at * STEP }}
								>
									{mark.label}
								</span>
							))}
						</div>

						{/*
						 * 손짓은 여기서 한 번만 받는다 — 아래 칸들은 표시일 뿐이다.
						 *
						 * biome은 마우스 이벤트 옆에 `onFocus`를 두라고 한다. 여기에는
						 * 둘 자리가 없다 — 안에 초점을 받는 것이 하나도 없으므로 그
						 * 핸들러는 영영 불리지 않는 죽은 코드가 된다. 대신 격자 전체가
						 * 요약을 단 그림(`role="img"`)이라, **손을 얹어야만 알 수 있는
						 * 것이 없다**: 하루하루의 숫자는 곁들이는 것이고 이 그림이
						 * 말하는 것은 얼마나 자주 썼는가다.
						 */}
						{/* biome-ignore lint/a11y/useKeyWithMouseEvents: 안에 초점 받을 것이 없다 — 위 주석 참고 */}
						<div
							role="img"
							aria-label={요약}
							className="flex"
							style={{ gap: GAP }}
							onMouseOver={짚기}
							onMouseLeave={() => setPoked(null)}
						>
							{grid.map((week) => (
								<div
									key={week.days.find(Boolean)?.day ?? "빈주"}
									className="flex flex-col"
									style={{ gap: GAP }}
								>
									{week.days.map((cell, i) =>
										cell ? (
											<div
												key={cell.day}
												data-day={cell.day}
												className={`rounded-[2px] ${FILL[cell.level]}`}
												style={{ width: CELL, height: CELL }}
											/>
										) : (
											<div
												// biome-ignore lint/suspicious/noArrayIndexKey: 아직 오지 않은 날은 이름이 없다
												key={i}
												style={{ width: CELL, height: CELL }}
											/>
										),
									)}
								</div>
							))}
						</div>
					</div>
				</ScrollArea>
			</div>

			<div className="mt-2 flex items-center justify-between gap-4 text-muted-foreground text-xs">
				{/*
				 * 짚은 칸을 읽어 준다. 아무것도 안 짚었을 때 비워 두면 손을 얹는
				 * 순간 아래가 밀려 내려가므로, 같은 자리에 안내를 세워 둔다.
				 */}
				<span className="min-w-0 truncate tabular-nums">
					{poked ? describeDay(poked) : "칸에 손을 올리면 그날을 읽어 줍니다"}
				</span>

				<span className="flex shrink-0 items-center gap-1" aria-hidden>
					적게
					{FILL.map((fill) => (
						<span
							key={fill}
							className={`rounded-[2px] ${fill}`}
							style={{ width: CELL, height: CELL }}
						/>
					))}
					많이
				</span>
			</div>
		</div>
	);
}
