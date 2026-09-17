export const TEMPLATE_DOWNLOAD_ANNOUNCEMENT = {
	id: "template-download-v1",
	startsAt: "2026-09-17T14:00:00+09:00",
	endsAt: "2026-09-24T14:00:00+09:00",
	title:
		"원고지 양식 다운로드 기능이 추가되었습니다. 왼쪽 메뉴 하단을 확인해보세요!",
	description:
		"200자·400자·1000자 원고지를 PDF나 PNG로 내려받아 인쇄하거나 태블릿에서 사용해보세요. 칸 색상과 페이지 수, 시작 번호를 골라 A4 양식을 만들 수 있어요.",
} as const;

export function isAnnouncementActive(now = Date.now()): boolean {
	return (
		now >= Date.parse(TEMPLATE_DOWNLOAD_ANNOUNCEMENT.startsAt) &&
		now < Date.parse(TEMPLATE_DOWNLOAD_ANNOUNCEMENT.endsAt)
	);
}
