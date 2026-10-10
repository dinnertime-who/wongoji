export const CURRENT_ANNOUNCEMENT = {
	id: "punctuation-layout-v1",
	startsAt: "2026-10-10T12:00:00+09:00",
	endsAt: "2026-10-17T12:00:00+09:00",
	title: "원고지 문장부호 배치가 개선되었습니다.",
	description:
		"온점 바로 뒤의 닫는 큰따옴표·작은따옴표를 같은 칸에 배치합니다. 곧은따옴표에도 동일하게 적용됩니다.",
	example: {
		before: ["다", ".", "”"],
		after: ["다", ".”"],
	},
	note: "줄 끝에서는 마지막 글자와 문장부호를 같은 칸에 함께 배치합니다.",
} as const;

export function isAnnouncementActive(now = Date.now()): boolean {
	return (
		now >= Date.parse(CURRENT_ANNOUNCEMENT.startsAt) &&
		now < Date.parse(CURRENT_ANNOUNCEMENT.endsAt)
	);
}
