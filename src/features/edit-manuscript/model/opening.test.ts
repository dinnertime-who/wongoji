import { describe, expect, it } from "vitest";
import {
	type Effect,
	NOTHING_OPEN,
	type OpenEvent,
	type Opening,
	step,
} from "./opening";

/**
 * 원고를 여는 순서.
 *
 * **여기 적힌 것은 전부 실제로 났던 버그다.** 새로고침할 때마다 홈으로 튕기던
 * 것, 옮긴 원고가 본문을 잃던 것, 연결이 끊겼는데 "본문을 찾을 수 없습니다"가
 * 뜨던 것 — 셋 다 "지금 어느 국면인가"를 잘못 읽어서 났다.
 *
 * 이 순서들은 브라우저에서 손으로 재현하기 어렵다. 원고를 아주 빠르게 오가거나,
 * 색인보다 본문이 먼저 도착하게 만들거나, 저장 도중에 탭을 닫아야 한다. 순수
 * 함수로 떼어 놓은 값이 그것이다 — 여기서는 그냥 적어 보면 된다.
 */

/** 아무 탈 없이 다 도착한 경우. 어긋난 것만 인자로 적는다 */
const arrives = {
	index: (
		docId: string,
		o: Partial<Extract<OpenEvent, { kind: "index" }>> = {},
	) =>
		({ kind: "index", docId, pending: false, listed: true, ...o }) as OpenEvent,
	body: (
		docId: string,
		o: Partial<Extract<OpenEvent, { kind: "body" }>> = {},
	) =>
		({
			kind: "body",
			docId,
			reading: false,
			unreachable: false,
			missing: false,
			...o,
		}) as OpenEvent,
	typeset: (
		docId: string,
		o: Partial<Extract<OpenEvent, { kind: "typeset" }>> = {},
	) =>
		({
			kind: "typeset",
			docId,
			pending: false,
			ready: true,
			listed: true,
			...o,
		}) as OpenEvent,
};

/** 사건들을 차례로 넣고 마지막 자리와 시킨 일들을 본다 */
function run(events: OpenEvent[], from: Opening = NOTHING_OPEN) {
	const effects: Effect[] = [];
	let opening = from;
	for (const event of events) {
		const done = step(opening, event);
		opening = done.opening;
		effects.push(done.effect);
	}
	return { opening, effects, last: effects.at(-1) as Effect };
}

/** 원고 하나를 정상적으로 열어 둔 자리 */
const opened = (docId: string): Opening =>
	run([arrives.index(docId), arrives.body(docId)]).opening;

describe("색인이 오기 전", () => {
	it("아직 못 받은 목록으로는 아무 판단도 하지 않는다", () => {
		/*
		 * **없는 것과 아직 모르는 것은 다르다.** 뭉뚱그리면 새로고침할 때마다
		 * 멀쩡한 원고를 "없다"고 보고 홈으로 돌려보내고, 홈은 보관함이 비었다고
		 * 보고 원고를 새로 만든다.
		 */
		const { last } = run([
			arrives.index("a", { pending: true, listed: false }),
		]);
		expect(last).toEqual({ kind: "nothing" });
	});

	it("빈 주소는 없는 원고가 아니다 — 체험 모드도 이 훅을 지난다", () => {
		const { last } = run([arrives.index("", { listed: false })]);
		expect(last).toEqual({ kind: "nothing" });
	});
});

describe("여는 순서", () => {
	it("목록에 없는 원고는 열 수 있는 곳으로 보낸다", () => {
		const { last, opening } = run([arrives.index("없는것", { listed: false })]);
		expect(last).toEqual({ kind: "leave" });
		// 떠났으므로 열어 둔 것이 없다 — 밀린 저장이 여기로 흘러들면 안 된다
		expect(opening.meta).toBe("");
	});

	it("처음 여는 원고는 제목을 앉히고 화면을 비운다", () => {
		const { last } = run([arrives.index("a")]);
		expect(last).toEqual({ kind: "openMeta", docId: "a", blank: true });
	});

	it("본문이 목록보다 먼저 온 새로고침에서는 화면을 비우지 않는다", () => {
		/*
		 * 색인을 기다리는 동안 본문이 먼저 도착할 수 있다. 그때 이미 앉힌 본문을
		 * 다시 "불러오는 중"으로 되돌리면 방금 그린 원고가 한 번 깜빡인다.
		 */
		const { last } = run([
			arrives.index("a", { pending: true }),
			arrives.body("a"),
			arrives.index("a"),
		]);
		expect(last).toEqual({ kind: "openMeta", docId: "a", blank: false });
	});

	it("이미 연 원고는 색인이 다시 와도 다시 앉히지 않는다", () => {
		// 색인은 다른 탭에서 무엇을 고칠 때마다 온다. 그때마다 되읽으면
		// 타이핑 도중에 에디터가 통째로 갈린다
		const { last } = run([arrives.index("a")], opened("a"));
		expect(last).toEqual({ kind: "nothing" });
	});

	it("본문을 읽는 중에는 아직 판단하지 않는다", () => {
		const { last } = run([arrives.body("a", { reading: true, missing: true })]);
		expect(last).toEqual({ kind: "nothing" });
	});

	it("본문이 도착하면 앉힌다", () => {
		const { last, opening } = run([arrives.index("a"), arrives.body("a")]);
		expect(last).toEqual({ kind: "seatBody", docId: "a" });
		expect(opening.body).toBe("a");
	});

	it("이미 앉힌 본문은 다시 앉히지 않는다", () => {
		const { last } = run([arrives.body("a")], opened("a"));
		expect(last).toEqual({ kind: "nothing" });
	});
});

describe("본문을 열지 못했을 때", () => {
	it("닿지 못한 것과 없는 것을 가른다", () => {
		/*
		 * **뭉뚱그리면 안 된다.** "찾을 수 없습니다" 화면에는 "빈 원고로 시작"이
		 * 있고, 연결이 잠깐 끊겼을 뿐인데 그것을 누르면 멀쩡한 원고를 덮는다.
		 */
		expect(
			run([arrives.body("a", { unreachable: true, missing: true })]).last,
		).toEqual({ kind: "unreachable" });
		expect(run([arrives.body("a", { missing: true })]).last).toEqual({
			kind: "lost",
		});
	});

	it("못 연 원고는 앉혔다고 표시하지 않는다 — 뒤늦게 오면 그때 앉는다", () => {
		/*
		 * 다른 기기에서 쓴 본문이 늦게 도착할 수 있다. 표시해 두면 그것이 와도
		 * 화면은 "찾을 수 없습니다"에 머문다.
		 */
		const 잃음 = run([arrives.body("a", { missing: true })]);
		expect(잃음.opening.body).toBe("");
		expect(run([arrives.body("a")], 잃음.opening).last).toEqual({
			kind: "seatBody",
			docId: "a",
		});

		const 못닿음 = run([
			arrives.body("a", { unreachable: true, missing: true }),
		]);
		expect(못닿음.opening.body).toBe("");
		expect(run([arrives.body("a")], 못닿음.opening).last).toEqual({
			kind: "seatBody",
			docId: "a",
		});
	});
});

describe("에디터가 알려 올 때", () => {
	it("앉힌 직후의 첫 알림은 삼킨다", () => {
		/*
		 * 에디터는 마운트될 때 한 번 알려 오는데 그것은 **방금 우리가 넣어 준 그
		 * 내용**이다. 그대로 저장하면 원고를 열기만 해도 본문이 서버로 써지고,
		 * 그 쓰기가 완성을 퇴고로 내린다.
		 */
		const 앉힘 = run([arrives.index("a"), arrives.body("a")]);
		expect(앉힘.opening.echo).toBe(true);

		const 첫알림 = run([{ kind: "editor" }], 앉힘.opening);
		expect(첫알림.last).toEqual({ kind: "nothing" });
		expect(첫알림.opening.echo).toBe(false);
	});

	it("그다음부터는 사람이 친 것이다", () => {
		const { last } = run([{ kind: "editor" }, { kind: "editor" }], opened("a"));
		expect(last).toEqual({ kind: "save" });
	});

	it("원고를 옮겨 앉힐 때마다 다시 한 번 삼킨다", () => {
		const 둘째 = run(
			[
				{ kind: "editor" },
				arrives.index("b"),
				arrives.body("b"),
				{ kind: "editor" },
			],
			opened("a"),
		);
		expect(둘째.last).toEqual({ kind: "nothing" });
	});

	it("밖에서 갈아 끼운 것은 삼키지 않는다", () => {
		/*
		 * 불러오기·빈 원고로 시작·비우기가 여기다. 갈아 끼운 쪽이 저장을 따로
		 * 시키고, 뒤따라오는 마운트 알림은 같은 내용이라 큐에서 합쳐진다.
		 *
		 * **비우기만은 저장을 시키지 않는다.** 그래서 이 알림이 빈 본문을 한 번
		 * 더 쓴다 — 같은 값이라 잃는 것은 없지만 왕복이 한 번 는다.
		 */
		const { last } = run(
			[
				// 앉힌 뒤의 마운트 알림이 먼저 삼켜지고 —
				{ kind: "editor" },
				// 갈아 끼우면 에디터가 다시 마운트되어 또 알려 온다
				{ kind: "showed" },
				{ kind: "editor" },
			],
			opened("a"),
		);
		expect(last).toEqual({ kind: "save" });
	});
});

describe("분량 다시 세기", () => {
	it("본문과 목록이 둘 다 온 뒤에 본다", () => {
		// 본문이 목록보다 먼저 오는 새로고침에서 "목록에 없는 원고"로 보고
		// 지나가면, 목록이 도착해도 다시 볼 길이 없었다
		expect(run([arrives.typeset("a", { pending: true })]).last).toEqual({
			kind: "nothing",
		});
		expect(run([arrives.typeset("a", { ready: false })]).last).toEqual({
			kind: "nothing",
		});
		expect(run([arrives.typeset("a", { listed: false })]).last).toEqual({
			kind: "nothing",
		});
	});

	it("원고마다 한 번만 본다", () => {
		// 타이핑 중에도 오는 사건이라, 표시하지 않으면 글자 하나마다 서버로 간다
		const { effects } = run([arrives.typeset("a"), arrives.typeset("a")]);
		expect(effects).toEqual([
			{ kind: "recount", docId: "a" },
			{ kind: "nothing" },
		]);
	});

	it("원고를 옮기면 그 원고도 한 번 본다", () => {
		const { last } = run([arrives.typeset("a"), arrives.typeset("b")]);
		expect(last).toEqual({ kind: "recount", docId: "b" });
	});
});

describe("다시 읽기", () => {
	it("제목과 본문이 함께 다시 앉는다", () => {
		// 이력에서 되돌리면 서버의 본문이 갈린다. 둘 중 하나만 비우면 제목이
		// 옛것으로 남거나 본문이 그대로 남는다
		const 되돌림 = run([{ kind: "reread" }], opened("a"));
		expect(되돌림.opening.meta).toBe("");
		expect(되돌림.opening.body).toBe("");

		const { effects } = run(
			[arrives.index("a"), arrives.body("a")],
			되돌림.opening,
		);
		expect(effects).toEqual([
			{ kind: "openMeta", docId: "a", blank: true },
			{ kind: "seatBody", docId: "a" },
		]);
	});

	it("분량은 다시 세지 않는다 — 서버가 그 버전의 값으로 이미 고쳤다", () => {
		const 되돌림 = run(
			[arrives.typeset("a"), { kind: "reread" }, arrives.typeset("a")],
			opened("a"),
		);
		expect(되돌림.last).toEqual({ kind: "nothing" });
	});
});

describe("원고를 빠르게 오갈 때", () => {
	it("앞 원고를 닫기 전에는 뒤 원고의 본문을 앉히지 않는다", () => {
		/*
		 * 주소가 먼저 바뀌고 본문은 뒤따라 온다. 그 틈에 앞 원고의 읽기가 끝나도
		 * 그것은 앞 원고의 칸으로 들어가므로, 뒤 원고의 자리를 건드리지 않는다.
		 */
		const { effects } = run(
			[arrives.index("b"), arrives.body("a"), arrives.body("b")],
			opened("a"),
		);
		expect(effects).toEqual([
			{ kind: "openMeta", docId: "b", blank: true },
			// a는 이미 앉혔으므로 늦게 온 읽기가 아무 일도 하지 않는다
			{ kind: "nothing" },
			{ kind: "seatBody", docId: "b" },
		]);
	});

	it("셋을 잇달아 열어도 마지막 것만 남는다", () => {
		const { opening } = run(
			[
				arrives.index("a"),
				arrives.index("b"),
				arrives.index("c"),
				arrives.body("c"),
			],
			NOTHING_OPEN,
		);
		expect(opening.meta).toBe("c");
		expect(opening.body).toBe("c");
	});
});

describe("순수하다", () => {
	it("받은 자리를 고치지 않는다", () => {
		const before = opened("a");
		const copy = { ...before };
		step(before, arrives.index("b"));
		step(before, { kind: "editor" });
		expect(before).toEqual(copy);
	});
});
