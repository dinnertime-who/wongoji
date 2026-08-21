# 계획 — 검색 엔진 최적화 (SEO)

> 작성일: 2026-08-18  
> 대상: `https://wongo.dinnertimes.app` (원고지 서비스)  
> 상태: 계획 수립 및 구현 준비

---

## 1. 개요 및 목표 (Overview & Objectives)

**원고지(wongoji)** 서비스를 구글(Google) 및 국내 주요 검색엔진(네이버 등)에 효과적으로 노출하고, 공모전 응모자, 작가, 학생 등 타깃 사용자가 유입될 수 있도록 **기술적 SEO(On-Page SEO) 및 검색엔진 등록 계획**을 정의합니다.

### 핵심 목표
1. **타깃 검색어 상위 노출**: "200자 원고지", "원고지 작성법", "공모전 원고지 매수 계산", "원고지 조판" 등의 키워드 점유.
2. **크롤러 친화적 메타데이터 구축**: Googlebot이 SSR 결과물에서 사이트 정체성과 기능을 명확히 수집할 수 있도록 표준 메타 태그, Open Graph, JSON-LD 구조화 데이터 적용.
3. **신속한 색인(Indexing)**: `robots.txt`, `sitemap.xml` 및 Google Search Console 등록을 통해 배포 직후 빠른 색인 완료.

---

## 2. 타깃 키워드 분석 (Target Keywords)

| 구분 | 주요 검색 키워드 | 유입 의도 |
| :--- | :--- | :--- |
| **핵심 키워드** | 원고지, 200자 원고지, 온라인 원고지 | 웹 상에서 원고지 양식에 글을 쓰고 조판하려는 목적 |
| **기능 키워드** | 원고지 조판, 원고지 줄바꿈, 원고지 띄어쓰기, 원고지 문장부호 | TOPIK/국어원 기준 작성법 및 자동 줄바꿈 확인 |
| **공모전/입시** | 신춘문예 매수 계산, 공모전 원고지, 70매 원고지, 백일장 원고지 | HWP 조판 기준 정확한 매수(쪽수) 확인 및 워드(.docx) 제출 |

---

## 3. 세부 작업 계획 (Implementation Plan)

### 3.1 기술적 SEO (On-Page SEO) 구현

#### [SEO-01] 메타 태그 및 Open Graph 최적화 (`src/routes/__root.tsx`)
* **Title**: `원고지 - 200자 원고지 조판 에디터 & 공모전 매수 계산`
* **Description**: `200자 원고지 규칙에 맞춰 실시간으로 조판해 주는 웹 에디터입니다. 공모전/신춘문예 원고지 매수(장수) 자동 계산, TOPIK 작성 규칙 준수, 워드(.docx) 내보내기를 지원합니다.`
* **Keywords**: `원고지, 200자 원고지, 원고지 작성법, 원고지 양식, 공모전 원고지, 신춘문예 매수 계산, 글자수 세기, 원고지 조판, 웹 원고지`
* **Canonical URL**: `https://wongo.dinnertimes.app`
* **Open Graph (SNS 미리보기)**:
  - `og:type`: `website`
  - `og:url`: `https://wongo.dinnertimes.app`
  - `og:title`: `원고지 - 200자 원고지 조판 에디터 & 공모전 매수 계산`
  - `og:description`: `200자 원고지 규칙에 맞춰 실시간으로 조판해 주는 웹 에디터`
  - `og:image`: `https://wongo.dinnertimes.app/og-image.png`
  - `og:site_name`: `원고지`
  - `og:locale`: `ko_KR`
* **Twitter Card**:
  - `twitter:card`: `summary_large_image`
  - `twitter:title`, `twitter:description`, `twitter:image`

#### [SEO-02] Schema.org JSON-LD 구조화 데이터 삽입
* 검색 결과에 리치 스니펫(Rich Snippets) 형태로 소프트웨어 애플리케이션 정보를 표시:
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "원고지",
  "alternateName": "200자 원고지 조판 에디터",
  "url": "https://wongo.dinnertimes.app",
  "description": "글을 200자 원고지 규칙에 맞춰 실시간으로 조판해 주는 웹 에디터",
  "applicationCategory": "WritingApplication",
  "operatingSystem": "All",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "KRW"
  }
}
```

---

### 3.2 검색 로봇 및 사이트맵 파일 생성 (`public/`)

#### [SEO-03] `public/robots.txt`
* 검색 크롤러 접근 허용 범위 정의 및 사이트맵 위치 안내:
```txt
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://wongo.dinnertimes.app/sitemap.xml
```

#### [SEO-04] `public/sitemap.xml`
* 구글에 사이트의 주요 페이지 구조를 명시:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://wongo.dinnertimes.app/</loc>
    <lastmod>2026-08-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

---

### 3.3 브랜드 정적 에셋 준비 (`public/`)

#### [SEO-05] 파비콘 및 OG 썸네일 이미지
1. `public/favicon.ico`, `public/apple-touch-icon.png`: 브라우저 탭 및 북마크 아이콘
2. `public/og-image.png`: 1200 × 630 px 규격의 링크 공유 미리보기 이미지 (원고지 격자 배경과 서비스 명칭이 정갈하게 들어간 디자인)

##### 만드는 방법 (구현 기록)

의존성을 더하지 않는다. **HTML을 헤드리스 크롬으로 찍는다** — `styles.css`의 팔레트를
그대로 쓸 수 있고, 한글이 실제 렌더링 그대로 나온다.

```sh
perl -e 'alarm 30; exec @ARGV' \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --no-first-run \
  --force-device-scale-factor=1 --virtual-time-budget=3000 \
  --window-size=1200,630 --user-data-dir="$TMP/chrome-profile" \
  --screenshot="public/og-image.png" "file://$TMP/og-image.html"
```

걸렸던 것 넷.

- `--force-device-scale-factor=1`이 없으면 이 맥의 DPR 2를 타서 2400×1260이 나온다.
  줄일 도구가 없으니 되돌릴 수 없다
- 크롬이 `--screenshot`을 쓰고도 **스스로 죽지 않는다.** macOS에는 `timeout`이 없어
  `perl -e 'alarm'`으로 끊는다. 성패는 종료 코드가 아니라 **파일이 나왔는지**로 본다
- 끊긴 크롬이 `--user-data-dir`에 `SingletonLock`을 남긴다. 다음 실행이 그 프로필을
  집으면 기존 인스턴스에 넘기고 조용히 빠져나가 **스크린샷을 찍지 않는다.** 매번
  프로필을 지우고 시작한다
- 명조 글리프가 em 박스를 넘어 아이콘에서 `원`의 아래가 잘렸다. `line-height`를
  상자 높이로 주고 글자를 상자의 0.54배로 줄여 맞췄다

아이콘은 **짙은 초록 바탕에 종이색 글자**다(`#5f7a52` / `#fffdf6`). 종이 바탕에 초록
칸을 두는 안(제품과 같은 얼굴)도 만들어 16px으로 나란히 찍어 보았는데, 밝은 탭 배경에
묻혀 사라졌다. 파비콘에서는 읽히는 쪽이 이긴다.

`favicon.ico`는 16·32·48 PNG를 ICO 컨테이너로 감싼 것이다. Vista 이후의 브라우저는
PNG를 품은 `.ico`를 읽으므로 BMP로 풀어 쓰지 않는다.

---

## 4. 검색엔진 등록 및 색인(Indexing) 운영 절차

배포 완료 후 진행하는 검색엔진 등록 단계입니다.

### 4.1 구글 서치 콘솔 (Google Search Console)
> **도메인 속성 인증 완료 확인 (2026-08-18)**  
> 이미 `dinnertimes.app`이 GSC에 **도메인 속성(DNS 인증)**으로 등록되어 있으므로, 모든 서브도메인(`*.dinnertimes.app`)이 자동으로 인증 범위에 포함됩니다. **별도의 소유권 인증 메타 태그나 파일 추가가 불필요합니다.**

1. **[Google Search Console](https://search.google.com/search-console)** 접속 후 속성 목록에서 `dinnertimes.app` 선택
2. **사이트맵 제출**:
   - 좌측 **Sitemaps** 메뉴 이동
   - 새 사이트맵 추가에 `https://wongo.dinnertimes.app/sitemap.xml` 입력 후 제출
3. **URL 검사 및 색인 생성 요청**:
   - 상단 URL 검사창에 `https://wongo.dinnertimes.app` 입력
   - 검사 결과 화면에서 **[색인 생성 요청 (Request Indexing)]** 클릭
4. *(선택)* `wongo.dinnertimes.app` 단독 검색 실적(노출/클릭 수)만 분리해서 보려면 [속성 추가] → URL 접두사로 `https://wongo.dinnertimes.app`을 추가 (도메인 권한으로 별도 인증 절차 없이 즉시 자동 등록됨).

### 4.2 네이버 서치어드바이저 (Naver Search Advisor)
1. **[네이버 서치어드바이저](https://searchadvisor.naver.com/)** 웹마스터 도구에 `https://wongo.dinnertimes.app` 등록
2. `<meta name="naver-site-verification" content="..." />` 태그 또는 HTML 파일로 소유권 인증
3. 사이트맵(`https://wongo.dinnertimes.app/sitemap.xml`) 제출

---

## 5. 실행 체크리스트

### 코드 및 에셋 구현
- [x] `src/routes/__root.tsx`에 Title, Meta Description, Keywords, OG 태그 적용
- [x] `src/routes/__root.tsx`에 JSON-LD Schema.org 구조화 데이터 추가
- [x] `public/robots.txt` 생성
- [x] `public/sitemap.xml` 생성
- [x] `public/og-image.png` 및 파비콘 에셋 확인/배치
- [ ] 배포 (`pnpm run deploy`) 후 메타데이터 및 `robots.txt`/`sitemap.xml` 접근 확인

계획에서 두 군데 벗어났다. 둘 다 이유가 있다.

**canonical은 `__root`가 아니라 `routes/index.tsx`에 있다.** 계정 쪽(`_app`)은
`noindex`인데, 루트에 canonical을 두면 그 쪽들까지 "정본은 홈이다"라고 말하게 된다.
색인하지 말라는 쪽이 홈을 제 정본으로 가리키면 **구글이 그 지시를 홈으로 옮겨 읽어
홈까지 색인에서 뺄 수 있다.** 색인되는 쪽에만 둔다.

**`_app`에 `noindex, nofollow`와 짧은 제목을 더했다.** 계획에 없던 것이다. 비로그인
크롤러에게 `/w/<id>`는 빈 껍데기라, 막지 않으면 제목이 같은 빈 쪽이 여럿 색인되어
정작 보여야 할 홈이 그 사이에 묻힌다. robots.txt로 막지 않는 이유는 반대다 — 거기서
막으면 크롤러가 문서를 못 읽어 이 `noindex`도 못 본다. 제목을 덮는 것은 검색용 제목이
키워드를 담느라 길어서, 원고를 쓰는 내내 띄워 두는 탭에 맞지 않기 때문이다.

`og:image:width`/`height`/`alt`도 더했다. 스크래퍼가 그림을 받기 전에 자리를 잡아,
처음 공유될 때 카드가 접혀 나오는 일이 줄어든다.

### 키워드용 본문 (2026-08-18 추가)
- [x] `/guide` 목차와 글 넷 — 작성법 · 띄어쓰기와 줄바꿈 · 문장부호 · 공모전 매수 계산
- [x] 에디터(체험 원고) 발치에 사용법 링크 — 크롤러가 `/`에서 타고 갈 길
- [x] `public/sitemap.xml`에 다섯 주소 추가 + 목록과 어긋나면 깨지는 테스트

3절의 기술적 SEO는 **읽을 메타데이터**를 갖춘 것이고, 이쪽이 **읽을 본문**이다.
2절 키워드 표의 세 갈래를 쪽 하나씩에 맡겼다 — 한 쪽이 서로 다른 질의를 동시에
먹으려 하면 어느 쪽에도 잘 걸리지 않는다.

재료는 `docs/wongoji-rules.md`와 `docs/contest-features.md`다. 다만 그 둘은 "확인
실패", "추측하지 않음" 같은 내부 명세라 그대로 내보내지 않고 읽을 글로 다시 썼다.
**확인하지 못한 것은 글에도 적지 않았다** — 각주·단위 기호 배정, 한글(HWP)의 정확한
매수 알고리즘이 그렇다. 후자는 "한글과 같은 *방식*"이라고만 쓰고 같은 *숫자*라고
쓰지 않았다(`contest-features.md`의 미확인 항목).

규칙을 보이는 예시는 **캡처 이미지가 아니라 `layoutBlocks`를 그대로 돌린 결과다.**
그림을 쓰면 조판 규칙을 고쳤을 때 글 속 그림이 조용히 거짓이 된다.

### 검색엔진 색인 요청
- [x] Google Search Console 도메인 속성(`dinnertimes.app`) 소유권 인증 완료
- [ ] Google Search Console에 `https://wongo.dinnertimes.app/sitemap.xml` 제출
- [ ] Google Search Console URL 색인 생성 요청
- [ ] Naver Search Advisor 소유권 인증 및 사이트맵 제출

---

## 6. 2차 보강 (2026-08-21) — 홈이 걸려야 할 질의

노리는 말이 다섯 늘었다. 전부 **홈이 받아야 하는** 질의다.

| 검색어 | 유입 의도 |
| :--- | :--- |
| 원고지 사이트 · 원고지 온라인 | 원고지 양식에 글을 쓸 **곳**을 찾는다 |
| 원고지 작성 · 원고지 작성 사이트 | 위와 같되 "쓴다"는 행위가 앞에 있다 |
| 원고지 작성 프로그램 | 설치할 것을 찾고 있다. **설치가 필요 없다는 것이 답이다** |

2절의 표와 갈래가 다르다. 그쪽은 규칙을 묻는 정보성 질의라 사용법 글 넷이 받지만,
이 다섯은 **도구를 찾는 질의**여서 받을 수 있는 쪽이 `/` 하나뿐이다.

### 무엇이 문제였나

`/`는 크롤러에게 **빈 쪽이었다.** 비로그인으로 들어오면 원고 한 편이 그대로 열리는데,
그 화면에 있는 글자라고는 빈 에디터의 안내문 한 줄과 원고지 격자뿐이다. 노리는 말은
전부 메타 태그 안에만 있었다 — 메타는 **이미 찾은 쪽을 어떻게 소개할지**를 정할 뿐,
없는 본문을 대신해 주지 않는다. `h1`도 없었다(제목 자리가 사람이 치는 입력칸이라,
heading으로 둘 수 없었다).

### [SEO-06] 홈에 읽을 본문을 둔다

`shared/config/landing.ts`에 소개·기능 여섯·문답 여섯을 두고, `shared/ui/landing-intro`가
원고지 **아래**에 그린다. 쓰는 자리를 밀어내지 않도록 접히는 곳 아래에 두었다 — 글을
쓰러 온 사람은 여기까지 내려올 일이 없다.

- 쪽의 `h1`이 여기 생겼다(`온라인 원고지 작성 사이트`)
- 뼈대는 `h1` → `h2` 셋 → `h3` 여섯. 기능 여섯을 저마다 `h2`로 두면 크롤러가 읽는
  목차가 `h2` 여덟이 되어 무엇이 절인지 구분되지 않는다
- 읽을 수 있는 글자가 0자에서 약 1,700자가 되었다

**앱에 없는 기능은 적지 않았다.** 검색에 걸리려고 부풀리면 들어온 사람이 곧바로 나가고,
그 이탈이 다시 순위를 깎는다. 여섯 줄은 전부 지금 화면에서 눌러 볼 수 있는 것들이다.

### [SEO-07] 문답을 FAQPage 구조화 데이터로

`routes/index.tsx`가 화면과 **같은 배열**(`FAQ`)로 JSON-LD를 짓는다. 구글은 FAQ
구조화 데이터가 쪽에 실제로 보이는 글과 같을 것을 요구하므로 두 곳에 따로 적을 수 없다.
`details`로 접지 않은 이유도 같다 — 처음에 보이지 않는 글을 가리키게 된다.

`_app`이 아니라 `index`에 둔 이유는 canonical과 같다. 문답이 그려지는 쪽은 `/` 하나다.

### [SEO-08] 문구와 나머지 구조화 데이터

- `SITE_TITLE` — 앞머리를 `온라인 원고지 작성 사이트`로. 구글이 한글 제목을 서른 자
  남짓에서 자르므로 뒤에 붙은 것은 못 읽는다고 본다. 이 한 마디가 노리는 다섯 개를
  함께 문다
- `SITE_DESCRIPTION` — `설치 없이` · `회원가입 없이`를 앞으로. `원고지 작성 프로그램`으로
  찾는 사람이 재고 있는 것이 그 둘이라, 검색 결과에서 이미 답이 보여야 누른다
- `WebApplication` — `alternateName`(부르는 다른 이름 셋) · `featureList` ·
  `browserRequirements` · `isAccessibleForFree` · `inLanguage`를 더했다
- `BreadcrumbList` — 사용법 목차와 글 넷에. 검색 결과가 `원고지 › 사용법 › 문장부호`로
  보이고, 글 넷이 홈에 딸린 한 묶음으로 읽힌다
- `/`에 `robots: index, follow`를 명시했다. 적지 않아도 기본값이지만, 계정 쪽이
  `noindex`라 "무엇이 색인되는가"가 두 곳에 나뉘어 있다. 양쪽 다 제 입으로 말하게 둔다

### 검사

`shared/config/landing.test.ts`가 **화면에 그려지는 글**에서 노리는 말을 찾는다.
메타를 아무리 고쳐도 이 검사는 통과하지 않는다 — 메타에만 넣고 본문을 빠뜨리는 것이
바로 앞서 했던 실수라, 같은 실수가 조용히 돌아오지 않게 막는다.

### 남은 것

- [ ] 배포 후 [리치 결과 테스트](https://search.google.com/test/rich-results)로 FAQPage ·
      BreadcrumbList 인식 확인
- [ ] Google Search Console에 `/` 색인 재요청 (본문이 생겼으므로 다시 읽혀야 한다)
- [ ] Naver Search Advisor 소유권 인증 및 사이트맵 제출 (여전히 미완)
