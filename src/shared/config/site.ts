/**
 * 이 서비스가 바깥에 어떻게 소개되는가.
 *
 * 검색 결과의 제목·설명, 링크를 나눌 때 딸려 가는 그림이 여기 모여 있다.
 * `__root`가 문서 머리에 얹고, `index`가 canonical을 얹는다 — 같은 문구를
 * 두 곳에 적어 두면 한쪽만 고치게 된다.
 */

/**
 * 배포된 곳.
 *
 * **절대 URL이어야 한다.** canonical·Open Graph·JSON-LD를 읽는 것은 이 문서를
 * 받아 간 남의 서버(구글·카카오·트위터)라, 상대 경로에는 기준이 없다.
 */
export const SITE_URL = "https://wongo.dinnertimes.app";

/** 검색 결과에 걸리는 제목. 원고를 쓰는 동안의 탭 제목은 `_app`이 짧게 덮는다 */
export const SITE_TITLE =
	"원고지 - 200자 원고지 조판 에디터 & 공모전 매수 계산";

/** 제목 아래 딸려 나오는 설명 */
export const SITE_DESCRIPTION =
	"200자 원고지 규칙에 맞춰 실시간으로 조판해 주는 웹 에디터입니다. 공모전/신춘문예 원고지 매수(장수) 자동 계산, TOPIK 작성 규칙 준수, 워드(.docx) 내보내기를 지원합니다.";

/**
 * SNS 미리보기에 들어가는 설명.
 *
 * 검색용 설명과 따로 두는 이유는 자리가 다르기 때문이다 — 카카오톡·트위터의
 * 미리보기 카드는 두 줄 남짓에서 잘린다.
 */
export const SITE_SHARE_DESCRIPTION =
	"200자 원고지 규칙에 맞춰 실시간으로 조판해 주는 웹 에디터";

/** 링크를 나눌 때 딸려 가는 그림. `public/og-image.png`, 1200×630 */
export const SITE_OG_IMAGE = `${SITE_URL}/og-image.png`;

/** 검색어. 상위 몇 개 말고는 요즘 엔진이 보지 않지만, 네이버가 아직 읽는다 */
export const SITE_KEYWORDS =
	"원고지, 200자 원고지, 원고지 작성법, 원고지 양식, 공모전 원고지, 신춘문예 매수 계산, 글자수 세기, 원고지 조판, 웹 원고지";
