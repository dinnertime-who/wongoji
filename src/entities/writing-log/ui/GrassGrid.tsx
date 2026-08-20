import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "#/shared/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/shared/ui/tooltip";
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

/**
 * 아무리 좁아도 이만큼은 그린다.
 *
 * 이 아래로 내려가면 잔디가 아니라 점 몇 개다 — 그럴 바에는 넘치게 두고 밀어
 * 보는 편이 낫다. 320px 창에도 열아홉 주가 들어가므로 여기 걸리는 화면은
 * 거의 없다.
 */
const MIN_WEEKS = 12;

export function GrassGrid({
	today,
	log,
	weeks = 53,
}: {
	today: string;
	log: WritingLog;
	/** **최대** 몇 주를 그릴지. 자리가 좁으면 이보다 적게 그린다 */
	weeks?: number;
}) {
	/*
	 * 격자가 앉을 자리. **여기 폭이 몇 주를 그릴지 정한다.**
	 *
	 * 좁은 화면에서 53주를 그리면 격자만 가로로 밀린다. 밀 수 있다는 것을 알려면
	 * 스크롤바를 봐야 하고, 스크롤바를 보려면 이미 그 아래를 보고 있어야 한다 —
	 * 한눈에 보라고 만든 그림에 손짓을 하나 더 붙이는 셈이다. **그래서 좁으면
	 * 기간을 줄인다.** 오른쪽 끝(이번 주)은 어느 폭에서나 그대로고, 왼쪽에서
	 * 지난 달들이 빠진다.
	 *
	 * `flex-1`이라 이 칸의 폭은 바깥이 정한다 — 격자가 줄어도 칸은 그대로라 재기와
	 * 그리기가 서로를 물지 않는다. 재기 전(서버가 그린 첫 그림)에는 `weeks`
	 * 그대로다. 격자는 오른쪽 끝에서 시작하므로 줄어들어도 **보이던 자리는
	 * 그대로고 화면 밖 왼쪽이 사라질 뿐이다.**
	 */
	const box = useRef<HTMLDivElement>(null);
	const [fits, setFits] = useState<number | null>(null);

	useEffect(() => {
		const el = box.current;
		if (!el) return;

		const 재기 = (width: number) => {
			if (width <= 0) return;
			// 마지막 주 오른쪽에는 사이가 없다 — 그 한 칸(GAP)을 되돌려 놓고 센다
			const 들어가는 = Math.floor((width + GAP) / STEP);
			setFits(Math.max(MIN_WEEKS, Math.min(weeks, 들어가는)));
		};

		재기(el.getBoundingClientRect().width);
		const 지켜보기 = new ResizeObserver(([entry]) => {
			if (entry) 재기(entry.contentRect.width);
		});
		지켜보기.observe(el);
		return () => 지켜보기.disconnect();
	}, [weeks]);

	const shown = fits ?? weeks;

	const grid = useMemo(() => buildGrid(today, log, shown), [today, log, shown]);
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
	 * 지금 짚고 있는 칸과 그 칸이 화면에서 앉은 자리.
	 *
	 * **툴팁은 한 벌뿐이다.** 칸마다 달면 371벌이 되고, 그만큼의 Radix 인스턴스가
	 * 격자 하나를 그리자고 뜬다. 손짓은 위에서 한 번만 받아 `data-day`로 칸을
	 * 되찾고, 자리는 그때 잰 사각형을 그대로 쓴다 — 격자가 가로로 밀려 있어도
	 * 화면 기준으로 잰 값이라 그 자리에 그대로 뜬다.
	 */
	const [poked, setPoked] = useState<{ cell: GrassCell; at: DOMRect } | null>(
		null,
	);

	const 짚기 = (event: React.MouseEvent) => {
		const target = event.target as HTMLElement;
		const day = target.dataset.day;
		const cell = day ? cells.get(day) : undefined;
		setPoked(cell ? { cell, at: target.getBoundingClientRect() } : null);
	};

	/**
	 * 격자 전체를 한 장의 그림으로 읽어 준다.
	 *
	 * 칸마다 `aria-label`을 달면 화면 낭독기가 371줄을 읽는다 — 그것은 잔디가
	 * 주려던 "한눈에"의 정반대다. 하루하루가 궁금한 사람에게는 원고 목록이 이미
	 * 있고, 이 그림이 말해야 하는 것은 **얼마나 자주 썼는가** 한 줄이다.
	 */
	const 요약 = `지난 ${shown}주 가운데 ${cells.size ? [...cells.values()].filter((c) => c.level > 0).length : 0}일을 썼습니다`;

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
				<div ref={box} className="min-w-0 flex-1">
					<ScrollArea orientation="horizontal" dir="rtl" type="auto">
						{/*
						 * 아래 여백은 스크롤바가 앉을 자리다. 스크롤바는 칸 안쪽에 절대
						 * 위치로 뜨므로, 비워 두지 않으면 격자 마지막 줄에 겹쳐 앉는다.
						 */}
						<div dir="ltr" className="w-max pb-3">
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
							 * 것이 없다**: 하루하루의 숫자는 툴팁으로 곁들이는 것이고, 이
							 * 그림이 말하는 것은 얼마나 자주 썼는가다.
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
			</div>

			{/*
			 * 짚은 칸을 읽어 준다.
			 *
			 * 전에는 격자 아래 한 줄에 적었다. 손이 칸에 있는데 글자는 저 아래에
			 * 있어서 눈이 두 번 움직였고, 아무것도 안 짚었을 때 자리를 지키느라
			 * "칸에 손을 올리면…"이라는 안내가 늘 서 있었다 — 격자 하나에 딸린
			 * 설명서다.
			 *
			 * **딸린 것은 붙잡는 것 옆에 뜬다.** 손잡이는 짚은 칸 위에 겹쳐 두는
			 * 빈 자리 하나뿐이고(`fixed`), 툴팁은 그것을 물고 뜬다. 손짓을 받지
			 * 않게 막아 둔다 — 칸 위에 얹히므로 그대로 두면 다음 칸으로 넘어가는
			 * 길을 제가 막는다.
			 */}
			{/* Radix는 Provider 안에서만 뜬다. 이 격자 밖에는 툴팁이 없어 여기 둔다 */}
			<TooltipProvider>
				<Tooltip open={poked !== null}>
					<TooltipTrigger asChild>
						<span
							aria-hidden
							className="pointer-events-none fixed"
							style={
								poked
									? {
											left: poked.at.left,
											top: poked.at.top,
											width: CELL,
											height: CELL,
										}
									: { display: "none" }
							}
						/>
					</TooltipTrigger>
					<TooltipContent side="top" className="tabular-nums">
						{poked && describeDay(poked.cell)}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}
