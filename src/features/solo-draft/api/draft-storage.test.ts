import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	readDraft,
	writeDraftBody,
	writeDraftGoal,
	writeDraftTitle,
} from "./draft-storage";

/**
 * 로그인 없이 쓰는 원고 한 편.
 *
 * **이 브라우저에만 있다.** 서버 사본이 없으므로 저장 실패를 삼키면 사용자는
 * 계속 쓰는데 아무것도 남지 않는다 — 그래서 실패가 반드시 값으로 나와야 하고,
 * 종류까지 갈라야 한다(가득 찼다 / 저장소를 못 쓴다).
 *
 * IndexedDB는 손에 쥘 수 있게 갈아 끼운다. 여기서 볼 것은 저장소 구현이 아니라
 * **실패를 어떻게 옮겨 적는가**다.
 */

const idb = vi.hoisted(() => ({
	memory: new Map<string, unknown>(),
	fail: null as Error | null,
}));

vi.mock("idb-keyval", () => ({
	createStore: () => ({}),
	get: async (key: string) => {
		if (idb.fail) throw idb.fail;
		return idb.memory.get(key);
	},
	set: async (key: string, value: unknown) => {
		if (idb.fail) throw idb.fail;
		idb.memory.set(key, value);
	},
}));

/** 원하는 대로 실패시킬 수 있는 가짜 localStorage */
function fakeStorage(fail?: () => Error): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		key: (i: number) => [...map.keys()][i] ?? null,
		getItem: (k: string) => map.get(k) ?? null,
		removeItem: (k: string) => void map.delete(k),
		setItem: (k: string, v: string) => {
			if (fail) throw fail();
			map.set(k, v);
		},
	};
}

const named = (name: string): Error => Object.assign(new Error(name), { name });

beforeEach(() => {
	idb.memory.clear();
	idb.fail = null;
	vi.stubGlobal("window", { localStorage: fakeStorage() });
});

afterEach(() => vi.unstubAllGlobals());

describe("빈 브라우저", () => {
	it("빈 원고로 시작한다", async () => {
		expect(await readDraft()).toEqual({ content: null, title: "", goal: 0 });
	});
});

describe("왕복", () => {
	it("본문과 제목과 목표가 그대로 돌아온다", async () => {
		await writeDraftBody({ type: "doc", content: [] });
		writeDraftTitle("감나무 있는 마당");
		writeDraftGoal(70);

		expect(await readDraft()).toEqual({
			content: { type: "doc", content: [] },
			title: "감나무 있는 마당",
			goal: 70,
		});
	});

	it("목표를 지우면 0이다", () => {
		writeDraftGoal(0);
		expect(writeDraftGoal(0)).toEqual({ ok: true });
	});
});

describe("읽어낼 수 없는 값", () => {
	it("목표가 숫자가 아니면 0으로 읽는다", async () => {
		// 사람이 손으로 고쳐 둘 수 있는 자리다. NaN이 목표 칸에 앉으면 안 된다
		window.localStorage.setItem("wongoji:v1:draft:goal", "일흔");
		expect((await readDraft()).goal).toBe(0);
	});

	it("저장소를 못 열어도 던지지 않는다 — 빈 원고로 시작한다", async () => {
		/*
		 * 사생활 보호 모드처럼 저장소가 아예 없는 환경이 있다. 여기서 던지면
		 * 화면이 통째로 내려앉아 글을 쓸 수조차 없다.
		 */
		idb.fail = named("InvalidStateError");
		expect(await readDraft()).toEqual({ content: null, title: "", goal: 0 });
	});
});

describe("저장이 실패하면 값으로 알린다", () => {
	it("가득 찬 것은 가득 찼다고 한다", async () => {
		// 백업을 권해야 하는 자리다. "알 수 없는 오류"로는 사용자가 할 일이 없다
		idb.fail = named("QuotaExceededError");
		expect(await writeDraftBody({})).toMatchObject({
			ok: false,
			kind: "quota",
		});
	});

	it("파이어폭스가 쓰는 이름도 같은 것으로 읽는다", async () => {
		idb.fail = named("NS_ERROR_DOM_QUOTA_REACHED");
		expect(await writeDraftBody({})).toMatchObject({
			ok: false,
			kind: "quota",
		});
	});

	it("그 밖의 실패는 저장소를 쓸 수 없는 것으로 본다", async () => {
		idb.fail = named("InvalidStateError");
		expect(await writeDraftBody({})).toMatchObject({
			ok: false,
			kind: "unavailable",
		});
	});

	it("제목도 실패를 삼키지 않는다", () => {
		// 제목은 짧아서 localStorage에 둔다. 그쪽이 막혀도 알려야 한다
		vi.stubGlobal("window", {
			localStorage: fakeStorage(() => named("QuotaExceededError")),
		});
		expect(writeDraftTitle("제목")).toMatchObject({ ok: false, kind: "quota" });
	});

	it("성공하면 성공이라고 한다", async () => {
		expect(await writeDraftBody({})).toEqual({ ok: true });
		expect(writeDraftTitle("제목")).toEqual({ ok: true });
		expect(writeDraftGoal(70)).toEqual({ ok: true });
	});
});
