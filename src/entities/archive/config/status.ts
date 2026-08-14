/**
 * 원고의 진행 상태.
 *
 * **기본은 "초고"다.** 한 글자라도 쓰기 시작한 원고는 이미 초고이고, 그 앞에
 * "아직 안 정했다"를 두면 사람이 라벨을 켜기 전까지 어떤 원고도 진행에 들어오지
 * 않는다. 처음부터 초고에 세워 두면 상태를 고르는 일이 **켜는 일이 아니라
 * 다음으로 옮기는 일**이 된다.
 *
 * 비어 있는 값도 초고로 읽는다(`statusOf`). 있던 원고의 빈 칸을 채우는
 * 마이그레이션을 돌리지 않는 쪽을 골랐다 — 읽는 규칙 하나면 옛 행과 새 행이
 * 같은 뜻이 되고, 되돌릴 일이 생겨도 지운 자국이 남지 않는다.
 *
 * 이름을 두 글자로 맞춘 것은 폭이 예측 가능해야 좁은 줄에 들어가기 때문이다.
 *
 * 처음에는 공모전을 겨냥해 `제출`을 두려 했는데 뺐다 — 어디에 내는지는 원고
 * 바깥의 일이고, 글 자체의 상태는 완성이냐 아니냐다.
 */

export const DOC_STATUSES = ["draft", "revising", "done"] as const;

export type DocStatus = (typeof DOC_STATUSES)[number];

/** 새 원고가 서는 자리. 적히지 않은 원고도 여기로 읽는다 */
export const DEFAULT_STATUS: DocStatus = "draft";

/**
 * 적힌 상태. 비어 있으면 기본값이다.
 *
 * 색인에도 DB 컬럼에도 빈 값이 남아 있다 — 상태가 생기기 전에 쓴 원고들이다.
 * `?? DEFAULT_STATUS`를 부르는 곳마다 흩어 놓으면 한 곳은 반드시 빠뜨린다.
 */
export const statusOf = (v: DocStatus | null | undefined): DocStatus =>
	v ?? DEFAULT_STATUS;

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

/**
 * 상태를 올리는 전이인가.
 *
 * 빈 값은 양쪽 모두 초고로 친다. 그래서 **적히지 않은 원고에 초고를 적는 것은
 * 전이가 아니다** — 새로 만든 원고마다 빈 본문이 버전으로 박제되던 일이 여기서
 * 막힌다.
 */
export const isPromotion = (
	before: DocStatus | null | undefined,
	after: DocStatus | null | undefined,
): boolean => STATUS_RANK[statusOf(after)] > STATUS_RANK[statusOf(before)];

export const isDocStatus = (v: unknown): v is DocStatus =>
	typeof v === "string" && (DOC_STATUSES as readonly string[]).includes(v);
