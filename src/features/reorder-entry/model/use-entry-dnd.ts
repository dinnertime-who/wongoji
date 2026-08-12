import { useEffect, useRef, useState } from "react";
import type { Moving, Path } from "#/entities/archive";

/**
 * 목록에서 끌어다 놓기.
 *
 * **두 곳이 나눠 쓴다** — 보관함 트리와 폴더 쪽 목록. 짜임은 다르지만(한쪽은
 * 깊이가 있고 다른 쪽은 한 층이다) 손짓은 같아야 한다. 마우스로 끌면 브라우저의
 * 끌기를, 손가락으로 길게 누르면 우리가 연 끌기를 쓰는 것도 양쪽이 같다.
 *
 * 무엇을 어디에 놓을 수 있는지는 여기서 정하지 않는다. 색인을 아는 쪽이
 * `canDrop`으로 알려 주고, 실제로 옮기는 것도 `onDrop`을 받은 쪽이 한다.
 *
 * 두 목록이 화면에 함께 있어도 **끌기는 서로 남남이다.** 창을 건너 끌지 않는다 —
 * 그러려면 두 벌의 상태를 하나로 묶어야 하고, 손가락 쪽은 각자 창에 얹은
 * 리스너가 서로를 덮는다. 목록 사이를 옮기는 길은 ⋯ 메뉴의 이동에 있다.
 *
 * **키보드로는 끌 수 없다.** 그래서 끌기로 할 수 있는 일에는 반드시 ⋯ 메뉴 쪽
 * 짝이 있어야 한다 — 자리를 옮기는 것은 이동이, 차례를 바꾸는 것은 위로·아래로가
 * 받는다. 여기서 다는 핸들러는 전부 전개(spread)로 얹히므로 a11y 규칙이 그것을
 * 보지 못한다. 규칙이 잡아 주지 않는 만큼 이 약속은 사람이 지켜야 한다.
 */

/**
 * 손가락으로 이만큼 붙들고 있어야 끌기가 된다.
 *
 * 마우스에는 이 기다림이 없다 — 끌기와 누르기를 브라우저가 갈라 주기 때문이다.
 * 손가락은 그 둘이 같은 동작이라, 목록을 넘기려던 것과 구별하려면 시간이 든다.
 */
const LONG_PRESS = 500;

/** 기다리는 동안 이만큼 움직이면 넘기려던 손이다. 끌기로 치지 않는다 */
const PRESS_SLOP = 10;

/** 손을 뗀 뒤 이만큼은 뒤따라오는 탭을 삼킨다 */
const TAP_SWALLOW = 300;

/**
 * 길게 누르는 동안 글자가 잡히거나 확대 풍선이 뜨지 않게 한다.
 *
 * 목록의 제목은 읽는 것이지 긁어 가는 것이 아니라, 잃는 것이 없다.
 */
export const NO_CALLOUT = "select-none [-webkit-touch-callout:none]";

/** 줄에 얹으면 끌 수 있게 된다 */
interface DragProps {
	draggable: true;
	onDragStart: (e: React.DragEvent) => void;
	onDragEnd: () => void;
	onTouchStart: (e: React.TouchEvent) => void;
}

/** 줄에 얹으면 놓는 자리가 된다 */
interface DropProps {
	"data-drop-path": Path;
	onDragOver: (e: React.DragEvent) => void;
	onDrop: (e: React.DragEvent) => void;
}

export interface EntryDnd {
	/** 지금 끌고 있는 것 */
	drag: Moving | null;
	/** 그 줄을 끌고 있는가. 흐리게 그리는 데 쓴다 */
	isDragging: (id: string) => boolean;
	/** 놓을 수 있는 자리에 손이 올라와 있는가 */
	isOver: (to: Path) => boolean;
	dragProps: (item: Moving, label: string) => DragProps;
	dropProps: (to: Path) => DropProps;
	/** 목록을 감싸는 바깥. 빈 곳이 `root`가 되고, 끌기 뒤의 탭을 삼킨다 */
	rootProps: DropProps & {
		onClickCapture: (e: React.MouseEvent) => void;
		onContextMenu: (e: React.MouseEvent) => void;
	};
}

export function useEntryDnd({
	root,
	canDrop: allowed,
	onDrop,
}: {
	/** 빈 곳에 놓으면 여기로 간다 */
	root: Path;
	canDrop: (moving: Moving, to: Path) => boolean;
	onDrop: (moving: Moving, to: Path) => void;
}): EntryDnd {
	const [drag, setDrag] = useState<Moving | null>(null);
	/** 지금 손이 올라가 있는 자리 */
	const [over, setOver] = useState<Path | null>(null);
	/*
	 * 같은 값을 ref로도 든다.
	 *
	 * 창에 건 리스너는 걸던 순간의 값에 갇힌다. 다시 걸어 새 값을 보게 하면
	 * 손가락이 움직일 때마다 떼었다 붙이게 되므로, 읽기용으로 ref를 함께 둔다.
	 */
	const dragRef = useRef<Moving | null>(null);
	const overRef = useRef<Path | null>(null);

	const canDrop = (to: Path): boolean => {
		const dragging = dragRef.current ?? drag;
		return !!dragging && allowed(dragging, to);
	};

	const clear = () => {
		dragRef.current = null;
		overRef.current = null;
		setDrag(null);
		setOver(null);
	};

	const drop = (to: Path) => {
		const dragging = dragRef.current ?? drag;
		if (dragging && canDrop(to)) onDrop(dragging, to);
		clear();
	};

	/** 손가락이 붙들고 있는 중. 시간을 다 채우면 끌기가 된다 */
	const press = useRef<{
		item: Moving;
		x: number;
		y: number;
		timer: number;
	} | null>(null);
	/** 방금 끌기로 끝났다. 뒤따라오는 탭을 삼키는 데 쓴다 */
	const dragged = useRef(false);
	/*
	 * 손가락이 아직 화면에 있다.
	 *
	 * 브라우저의 링크 메뉴를 막을지 가리는 데 쓴다. drag 상태로는 늦다 — 메뉴가
	 * 뜨는 때와 끌기가 열리는 때가 같은 0.5초라, 다시 그려지기 전에 판정해야 한다.
	 */
	const touching = useRef(false);

	const forgetPress = () => {
		if (press.current) window.clearTimeout(press.current.timer);
		press.current = null;
	};

	/*
	 * 손가락으로 끄는 동안의 추적.
	 *
	 * 창에 직접 얹는다. React가 거는 touchmove는 passive라 목록이 따라 스크롤되는
	 * 것을 막을 수 없다.
	 *
	 * **손가락이 닿아 있는 동안에만 걸어 둔다.** 전에는 effect로 걸어서, 목록을
	 * 그리는 내내 창에 non-passive touchmove가 얹혀 있었다 — 끌 생각이 전혀 없는
	 * 사람의 스크롤까지 그 리스너를 거쳤다. 누르는 순간 걸고 떼는 순간 푼다.
	 */
	const detach = useRef<(() => void) | null>(null);

	const track = () => {
		// 앞선 손짓이 남아 있으면 먼저 푼다. 두 벌이 얹히면 놓기가 두 번 돈다
		detach.current?.();

		const move = (e: TouchEvent) => {
			const touch = e.touches[0];
			if (!touch) return;

			if (dragRef.current) {
				// 끌고 있는 동안에는 목록이 함께 움직이지 않아야 한다
				e.preventDefault();
				const row = document
					.elementFromPoint(touch.clientX, touch.clientY)
					?.closest<HTMLElement>("[data-drop-path]");
				const next = row?.dataset.dropPath ?? null;
				overRef.current = next;
				setOver(next);
				return;
			}

			// 아직 기다리는 중이다. 움직였으면 넘기려던 손으로 본다
			const waiting = press.current;
			if (!waiting) return;
			const strayed = Math.hypot(
				touch.clientX - waiting.x,
				touch.clientY - waiting.y,
			);
			if (strayed > PRESS_SLOP) forgetPress();
		};

		const end = () => {
			forgetPress();
			touching.current = false;
			detach.current?.();

			if (!dragRef.current) return;
			// 놓을 자리를 벗어난 채 손을 떼면 아무 일도 없다
			if (overRef.current) drop(overRef.current);
			else clear();
			// 손을 뗀 뒤 따라오는 탭이 원고를 열거나 폴더를 접지 않게 한다
			dragged.current = true;
			window.setTimeout(() => {
				dragged.current = false;
			}, TAP_SWALLOW);
		};

		window.addEventListener("touchmove", move, { passive: false });
		window.addEventListener("touchend", end);
		window.addEventListener("touchcancel", end);
		detach.current = () => {
			window.removeEventListener("touchmove", move);
			window.removeEventListener("touchend", end);
			window.removeEventListener("touchcancel", end);
			detach.current = null;
		};
	};

	// 세워 둔 타이머도 리스너도 남기지 않는다
	useEffect(
		() => () => {
			if (press.current) window.clearTimeout(press.current.timer);
			detach.current?.();
		},
		[],
	);

	return {
		drag,
		isDragging: (id) => drag?.id === id,
		isOver: (to) => Boolean(drag) && over === to && canDrop(to),

		/**
		 * 마우스는 브라우저의 끌기를 그대로 쓴다 — dataTransfer를 채워야 시작된다.
		 * 손가락에는 그 끌기가 오지 않으므로 길게 누르기로 따로 연다.
		 */
		dragProps: (item, label) => ({
			draggable: true,
			onDragStart: (e: React.DragEvent) => {
				e.stopPropagation();
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", label);
				dragRef.current = item;
				setDrag(item);
			},
			onDragEnd: clear,
			onTouchStart: (e: React.TouchEvent) => {
				const touch = e.touches[0];
				// 손가락 두 개 이상은 확대하려는 것이다
				if (e.touches.length !== 1 || !touch) return;

				forgetPress();
				dragged.current = false;
				touching.current = true;
				track();
				press.current = {
					item,
					x: touch.clientX,
					y: touch.clientY,
					timer: window.setTimeout(() => {
						press.current = null;
						dragRef.current = item;
						setDrag(item);
						// 끌기가 열렸다는 것을 손끝에 알린다. 없는 기기도 있다
						navigator.vibrate?.(10);
					}, LONG_PRESS),
				};
			},
		}),

		/**
		 * `data-drop-path`는 손가락 쪽에서 쓴다. 터치에는 "지금 이 줄 위에 있다"는
		 * 것을 알려 주는 이벤트가 없어, 좌표로 줄을 찾아낸 뒤 이 값을 읽는다.
		 */
		dropProps: (to) => ({
			"data-drop-path": to,
			onDragOver: (e: React.DragEvent) => {
				if (!canDrop(to)) return;
				// 바깥의 root 영역까지 올라가면 목적지가 root로 덮인다
				e.stopPropagation();
				e.preventDefault();
				overRef.current = to;
				setOver(to);
			},
			onDrop: (e: React.DragEvent) => {
				e.stopPropagation();
				e.preventDefault();
				drop(to);
			},
		}),

		rootProps: {
			"data-drop-path": root,
			/*
			 * 끌기로 끝난 손짓에는 탭이 뒤따라온다. 그대로 두면 옮기자마자 그 원고가
			 * 열리거나 폴더가 접힌다.
			 */
			onClickCapture: (e: React.MouseEvent) => {
				if (!dragged.current) return;
				dragged.current = false;
				e.preventDefault();
				e.stopPropagation();
			},
			/*
			 * 손가락으로 길게 누르면 브라우저가 링크 메뉴를 띄운다 — 줄이 링크라
			 * "새 탭에서 열기"가 끌기 위로 겹쳐 올라온다.
			 *
			 * 누르고 있는 중일 때만 막는다. 마우스 오른쪽 누르기는 그대로 두어야
			 * 데스크톱에서 원고를 새 탭으로 여는 길이 남는다.
			 */
			onContextMenu: (e: React.MouseEvent) => {
				if (touching.current || drag) e.preventDefault();
			},
			onDragOver: (e: React.DragEvent) => {
				// 여기서 막지 않으면 브라우저가 놓기를 거부한다
				if (!canDrop(root)) return;
				e.preventDefault();
				overRef.current = root;
				setOver(root);
			},
			onDrop: (e: React.DragEvent) => {
				e.preventDefault();
				drop(root);
			},
		},
	};
}
