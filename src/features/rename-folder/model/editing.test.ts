import { describe, expect, it } from "vitest";
import { hold, keepHeld, shownName, toFlush } from "./editing";

/**
 * 폴더 이름을 고치는 동안의 규칙.
 *
 * 짧지만 여기가 어긋나면 **먼저 보낸 요청의 늦은 응답이 방금 친 글자를 덮는다.**
 * 제목 칸이 글자마다 서버를 왕복하던 시절에 실제로 나던 일이다.
 */

const 습작 = { id: "a", name: "습작" };

describe("그릴 이름", () => {
	it("고치는 중이면 손에 든 것이 이긴다", () => {
		/*
		 * **여기가 이 파일의 이유다.** 정본을 그대로 그리면, 늦게 온 응답이
		 * 캐시를 `습작J`로 되돌리는 순간 화면의 열 글자가 사라진다.
		 */
		const held = hold("a", "습작ABCDEFGHIJ");
		expect(shownName(held, { id: "a", name: "습작J" })).toBe("습작ABCDEFGHIJ");
	});

	it("다른 폴더면 정본을 그린다", () => {
		const held = hold("a", "앞 폴더에 치던 글자");
		expect(shownName(held, { id: "b", name: "새 폴더" })).toBe("새 폴더");
	});

	it("손에 든 것이 없으면 정본을 그린다", () => {
		expect(shownName(null, 습작)).toBe("습작");
	});
});

describe("밀어 넣기", () => {
	it("손에 든 것이 정본과 다르면 보낸다", () => {
		const held = hold("a", "시집 원고");
		expect(toFlush(held, { id: "a", name: "새 폴더" })).toEqual(held);
	});

	it("정본과 같으면 보내지 않는다", () => {
		// 고쳤다 되돌린 글자까지 왕복시킬 이유가 없다
		const held = hold("a", "습작");
		expect(toFlush(held, 습작)).toBeNull();
	});

	it("다른 폴더로 넘어가면 앞 폴더의 것을 보낸다", () => {
		/*
		 * 디바운스가 터지기 전에 사이드바에서 다른 폴더를 열면, 마지막 몇 글자가
		 * 앞 폴더에 남아 있어야 한다. 지금 폴더의 정본과 견주면 안 된다.
		 */
		const held = hold("a", "마지막 글자");
		expect(toFlush(held, { id: "b", name: "다른 폴더" })).toEqual(held);
	});

	it("손에 든 것이 없으면 보낼 것도 없다", () => {
		expect(toFlush(null, 습작)).toBeNull();
	});

	it("임자를 늘 함께 든다 — 밀어 넣는 쪽이 헷갈릴 수 없다", () => {
		const held = hold("a", "시집 원고");
		expect(held.folderId).toBe("a");
	});
});

describe("폴더를 갈아탈 때", () => {
	it("같은 폴더고 정본보다 앞서면 지킨다", () => {
		const held = hold("a", "치고 있는 이름");
		expect(keepHeld(held, 습작, 0)).toEqual(held);
	});

	it("다른 폴더면 놓는다", () => {
		const held = hold("a", "앞 폴더에 치던 글자");
		expect(keepHeld(held, { id: "b", name: "새 폴더" }, 1)).toBeNull();
	});

	it("손에 든 것이 없으면 그대로다", () => {
		expect(keepHeld(null, 습작, 0)).toBeNull();
	});
});

describe("정본이 따라잡으면", () => {
	it("떠 있는 것이 없고 정본이 같으면 놓는다", () => {
		/*
		 * 놓고 나면 사이드바 다이얼로그가 바꾼 이름이 제목 칸에 보인다. 놓지
		 * 않으면 그 폴더에 머무는 동안 제목 칸만 옛 글자를 붙든다.
		 */
		const held = hold("a", "시집 원고");
		expect(keepHeld(held, { id: "a", name: "시집 원고" }, 0)).toBeNull();
	});

	it("떠 있는 것이 있으면 정본이 같아도 놓지 않는다", () => {
		/*
		 * 나중 저장의 응답이 먼저 오면 정본이 같아 보인다. 앞선 저장이 아직
		 * 떠 있는데 놓으면, 그 응답이 캐시를 옛 이름으로 되돌릴 때 화면만
		 * 거짓말한다.
		 */
		const held = hold("a", "가나");
		expect(keepHeld(held, { id: "a", name: "가나" }, 1)).toEqual(held);
	});

	it("그보다 앞선 글자를 들고 있으면 놓지 않는다", () => {
		/*
		 * **여기가 이 조건의 이유다.** 정본이 따라왔다고 놓으면, 늦게 온 응답이
		 * 캐시를 `습작J`로 되돌리는 순간 손에 든 열 글자가 사라진다. 치는 동안
		 * 손에 든 것은 늘 정본보다 앞서므로 이 가지로 들어온다.
		 */
		const held = hold("a", "습작ABCDEFGHIJ");
		expect(keepHeld(held, { id: "a", name: "습작J" }, 0)).toEqual(held);
	});
});

describe("같은 폴더", () => {
	it("늦게 온 값이 이긴다", () => {
		const 처음 = hold("a", "첫 이름");
		const 나중 = hold(처음.folderId, "고친 이름");
		expect(나중.name).toBe("고친 이름");
	});
});
