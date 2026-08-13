/**
 * 원고의 진행 상태.
 *
 * **기본은 "없음"이다.** 라벨은 켜는 것이라, 안 켠 원고는 뱃지 없이 지금과
 * 똑같이 보인다. `초고`를 기본값으로 두면 있던 원고 전부에 뜻 없는 표시가 돋는다.
 *
 * 이름을 두 글자로 맞춘 것은 폭이 예측 가능해야 좁은 줄에 들어가기 때문이다.
 *
 * 처음에는 공모전을 겨냥해 `제출`을 두려 했는데 뺐다 — 어디에 내는지는 원고
 * 바깥의 일이고, 글 자체의 상태는 완성이냐 아니냐다.
 */

export const DOC_STATUSES = ["draft", "revising", "done"] as const;

export type DocStatus = (typeof DOC_STATUSES)[number];

export const STATUS_LABEL: Record<DocStatus, string> = {
	draft: "초고",
	revising: "퇴고",
	done: "완성",
};

/**
 * 얼마나 나아갔는가. **버전을 남길지 가르는 값이다.**
 *
 * 올리는 전이(등급이 오르는 쪽)에만 그때의 원고를 박제한다. 내리는 전이는
 * 대개 시스템이 하는 강등이고, 그때 남길 본문은 이미 직전 버전으로 있다.
 * 이 규칙 하나가 버전 수에 자연스러운 상한을 만든다.
 */
export const STATUS_RANK: Record<DocStatus, number> = {
	draft: 1,
	revising: 2,
	done: 3,
};

/** 상태를 올리는 전이인가. 라벨이 없던 것에서 올라오는 것도 포함이다 */
export const isPromotion = (
	before: DocStatus | undefined,
	after: DocStatus | undefined,
): boolean =>
	after !== undefined &&
	STATUS_RANK[after] > (before ? STATUS_RANK[before] : 0);

export const isDocStatus = (v: unknown): v is DocStatus =>
	typeof v === "string" && (DOC_STATUSES as readonly string[]).includes(v);
