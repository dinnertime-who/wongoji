import { createStore, get, set } from "idb-keyval";
import type { DocContent } from "#/entities/manuscript";
import {
	type SaveResult,
	safeGetItem,
	safeSetItem,
} from "#/shared/lib/storage";

/**
 * 로그인 없이 쓰는 원고 한 편.
 *
 * **여기가 비로그인의 전부다.** 목록도 폴더도 휴지통도 없다 — 그것들은 계정
 * 기능이다. 색인이라는 것 자체가 없으므로 칸을 가르고 고아를 치우고 판을 올리는
 * 일이 전부 필요 없어졌다.
 *
 * 본문만 IndexedDB에 둔다. 장편 한 편이 300KB에 닿을 수 있어 localStorage의
 * 5MB를 혼자 갉아먹게 두고 싶지 않다. 제목과 목표는 짧아서 그냥 키로 둔다.
 */

const store = createStore("wongoji:draft", "draft");
const BODY = "content";
const TITLE = "wongoji:v1:draft:title";
const GOAL = "wongoji:v1:draft:goal";

export interface Draft {
	content: DocContent | null;
	title: string;
	goal: number;
}

export async function readDraft(): Promise<Draft> {
	let content: DocContent | null = null;
	try {
		content = (await get<DocContent>(BODY, store)) ?? null;
	} catch {
		// 저장소를 못 열었다. 빈 원고로 시작하는 수밖에 없다
	}

	return {
		content,
		title: safeGetItem(TITLE) ?? "",
		goal: Number(safeGetItem(GOAL)) || 0,
	};
}

/**
 * 본문을 저장한다. 실패를 값으로 돌려준다.
 *
 * 체험 원고는 **이 브라우저에만 있다.** 서버 사본이 없으므로 저장 실패를 삼키면
 * 사용자는 계속 쓰는데 아무것도 남지 않는다.
 */
export async function writeDraftBody(content: DocContent): Promise<SaveResult> {
	try {
		await set(BODY, content, store);
		return { ok: true };
	} catch (error) {
		const name = error instanceof Error ? error.name : "";
		if (
			name === "QuotaExceededError" ||
			name === "NS_ERROR_DOM_QUOTA_REACHED"
		) {
			return {
				ok: false,
				kind: "quota",
				message:
					"저장 공간이 가득 차 원고가 저장되지 않았습니다. 백업을 받아 주세요.",
			};
		}
		return {
			ok: false,
			kind: "unavailable",
			message:
				"이 브라우저에 원고를 저장하지 못했습니다. 사생활 보호 모드라면 일반 창에서 열어 주세요.",
		};
	}
}

export const writeDraftTitle = (title: string): SaveResult =>
	safeSetItem(TITLE, title);

export const writeDraftGoal = (goal: number): SaveResult =>
	safeSetItem(GOAL, String(goal));
