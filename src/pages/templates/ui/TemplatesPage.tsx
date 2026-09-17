import { Link } from "@tanstack/react-router";
import {
	TEMPLATE_FORMATS,
	templatePdfUrl,
	WongojiTemplate,
} from "#/entities/manuscript";
import { TemplateDownloader } from "#/features/download-template";
import { TEMPLATE_FAQ } from "#/shared/config/template-page";
import { PageHeader } from "#/widgets/page-header";

export function TemplatesPage() {
	return (
		<>
			<PageHeader sidebar={false}>
				<nav
					aria-label="현재 위치"
					className="flex min-w-0 items-center gap-2 text-xs"
				>
					<Link
						to="/"
						className="shrink-0 text-muted-foreground hover:text-foreground"
					>
						원고지
					</Link>
					<span aria-hidden="true" className="text-muted-foreground/50">
						/
					</span>
					<span className="truncate">양식 다운로드</span>
				</nav>
			</PageHeader>
			<main className="mx-auto w-full max-w-5xl px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
				<div className="mb-10 max-w-2xl">
					<p className="mb-3 font-medium text-muted-foreground text-xs">
						손으로 쓰는 시간을 위해
					</p>
					<h1 className="font-semibold text-3xl leading-tight tracking-tight sm:text-4xl">
						원고지 양식 다운로드
					</h1>
					<p className="mt-4 text-muted-foreground text-sm leading-7 sm:text-base">
						200자·400자·1000자 원고지를 PDF와 PNG로 무료 다운로드하세요. 색상과
						페이지 수, 시작 번호를 고르면 A4 세로 양식이 만들어집니다. 로그인
						없이 바로 이용할 수 있습니다.
					</p>
				</div>
				<TemplateDownloader />
				<section
					aria-labelledby="template-types-heading"
					className="mt-16 border-border border-t pt-10"
				>
					<h2 id="template-types-heading" className="font-semibold text-xl">
						200자·400자·1000자 원고지 양식
					</h2>
					<p className="mt-3 max-w-2xl text-muted-foreground text-sm leading-7">
						모든 양식은 정사각형 칸과 바깥 테두리, 오른쪽 상단의 No. 번호로
						구성됩니다. 용지 방향은 세로이며, 한 페이지에 원고지 한 장이
						들어갑니다.
					</p>
					<div className="mt-6 divide-y divide-border">
						{TEMPLATE_FORMATS.map((item) => (
							<article
								key={item.value}
								id={`template-${item.value}`}
								className="grid gap-5 py-7 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-7"
							>
								<WongojiTemplate
									format={item.value}
									color="red"
									className="hidden w-28 rounded-sm border border-border sm:block"
								/>
								<div>
									<h3 className="font-semibold text-base">
										{item.value}자 원고지 양식
									</h3>
									<p className="mt-2 text-muted-foreground text-sm leading-6">
										{item.description}
									</p>
									<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
										<a
											href={templatePdfUrl({
												format: item.value,
												color: "red",
												pages: 1,
												start: 1,
											})}
											download
											className="underline underline-offset-4"
										>
											{item.value}자 붉은색 PDF 받기
										</a>
										<a
											href={templatePdfUrl({
												format: item.value,
												color: "green",
												pages: 1,
												start: 1,
											})}
											download
											className="underline underline-offset-4"
										>
											{item.value}자 초록색 PDF 받기
										</a>
									</div>
								</div>
							</article>
						))}
					</div>
				</section>
				<section
					aria-labelledby="template-print-heading"
					className="mt-10 border-border border-t pt-10"
				>
					<h2 id="template-print-heading" className="font-semibold text-xl">
						원고지 인쇄 방법
					</h2>
					<ol className="mt-5 list-decimal space-y-3 pl-5 text-muted-foreground text-sm leading-7">
						<li>원고지 종류, 격자 색상, 페이지 수와 시작 번호를 선택합니다.</li>
						<li>PDF 다운로드를 누르고 받은 파일을 엽니다.</li>
						<li>
							인쇄 설정에서 A4 용지, 세로 방향, 실제 크기 또는 배율 100%를
							선택합니다.
						</li>
					</ol>
				</section>
				<section
					aria-labelledby="template-faq-heading"
					className="mt-12 border-border border-t pt-10"
				>
					<h2 id="template-faq-heading" className="font-semibold text-xl">
						원고지 양식 다운로드 FAQ
					</h2>
					<dl className="mt-6 space-y-6">
						{TEMPLATE_FAQ.map((item) => (
							<div key={item.question}>
								<dt className="font-medium text-sm">{item.question}</dt>
								<dd className="mt-2 max-w-3xl text-muted-foreground text-sm leading-7">
									{item.answer}
								</dd>
							</div>
						))}
					</dl>
				</section>
				<nav
					aria-label="원고지 관련 페이지"
					className="mt-12 flex flex-wrap gap-5 border-border border-t pt-6 text-sm"
				>
					<Link to="/guide" className="underline underline-offset-4">
						원고지 쓰는 법 보기
					</Link>
					<Link to="/" className="underline underline-offset-4">
						온라인에서 원고 쓰기
					</Link>
				</nav>
			</main>
		</>
	);
}
