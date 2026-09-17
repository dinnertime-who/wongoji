import { SITE_URL } from "./site";

export const TEMPLATE_PAGE_PATH = "/templates";
export const TEMPLATE_PAGE_URL = `${SITE_URL}${TEMPLATE_PAGE_PATH}`;
export const TEMPLATE_PAGE_TITLE =
	"원고지 양식 다운로드 — 200자·400자·1000자 PDF·PNG";
export const TEMPLATE_PAGE_DESCRIPTION =
	"200자, 400자, 1000자 원고지 양식을 무료로 다운로드하세요. A4 세로 인쇄용 PDF와 300dpi PNG를 제공합니다. 붉은색·초록색, 최대 100페이지, 시작 번호를 선택할 수 있으며 로그인 없이 이용할 수 있습니다.";
export const TEMPLATE_PAGE_KEYWORDS =
	"원고지 양식, 원고지 다운로드, 원고지 양식 PDF, 원고지 PNG, 200자 원고지, 400자 원고지, 1000자 원고지, A4 원고지, 무료 원고지, 원고지 인쇄";

export const TEMPLATE_FAQ = [
	{
		question: "원고지 양식을 무료로 받을 수 있나요?",
		answer:
			"200자·400자·1000자 양식을 모두 무료로 제공합니다. 회원가입이나 로그인 없이 다운로드할 수 있고, 로그인한 상태에서도 같은 페이지를 이용할 수 있습니다.",
	},
	{
		question: "PDF와 PNG 중 어떤 파일을 받으면 되나요?",
		answer:
			"종이에 인쇄하려면 용지 크기가 A4로 지정된 PDF를 권합니다. 문서나 학습 자료에 이미지로 넣으려면 흰 배경의 PNG를 받으세요. PNG는 2480 × 3508px이며 300dpi 해상도를 기록합니다.",
	},
	{
		question: "원고지를 여러 장 다운로드할 수 있나요?",
		answer:
			"페이지 수를 1~100 사이에서 선택하세요. PDF는 여러 페이지를 한 파일에 담고, PNG는 페이지별 이미지를 ZIP 파일로 묶습니다. 한 페이지만 선택하면 PNG 파일 하나를 받습니다.",
	},
	{
		question: "페이지 번호를 이어서 시작할 수 있나요?",
		answer:
			"시작 번호에 원하는 숫자를 입력하세요. 시작 번호가 11이고 페이지 수가 3이면 오른쪽 상단에 No. 11, No. 12, No. 13이 표시됩니다.",
	},
	{
		question: "원고지 PDF를 어떻게 인쇄하나요?",
		answer:
			"인쇄 설정에서 A4, 세로 방향, 실제 크기 또는 배율 100%를 선택하세요. 파일에는 페이지당 원고지 한 장이 들어 있습니다. 프린터 설정에 따라 선의 색상과 두께가 다르게 보일 수 있습니다.",
	},
] as const;
